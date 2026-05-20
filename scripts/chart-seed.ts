import { ethers, network } from 'hardhat';

const FACTORY = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

// Spread trades across simulated time so the chart actually has multiple candles.
async function bumpTime(seconds: number) {
  await network.provider.send('evm_increaseTime', [seconds]);
  await network.provider.send('evm_mine');
}

async function main() {
  const signers = await ethers.getSigners();
  const factory = await ethers.getContractAt('PumpFactory', FACTORY, signers[0]);
  const len = Number(await factory.coinsLength());
  if (len === 0) throw new Error('no coins — run smoke.ts first');
  const coin = await factory.coins(0);
  console.log('Seeding chart for', coin.token, 'curve', coin.curve);

  const curve = await ethers.getContractAt('PumpCurve', coin.curve);
  const token = await ethers.getContractAt('MemeToken', coin.token);

  // 30 trades across ~30 minutes (1m candle interval => 30 candles)
  const pattern = [
    +1, +3, +2, -1, +5, +2, -3, +1, +4, -2,
    +6, +8, -2, +3, -4, +2, +1, -1, +5, +7,
    -3, +2, +4, -5, +1, +3, +2, -1, +8, -4,
  ];

  for (let i = 0; i < pattern.length; i++) {
    const signer = signers[1 + (i % 9)]; // rotate buyers
    const curveS = curve.connect(signer);
    const tokenS = token.connect(signer);
    const amt = Math.abs(pattern[i]);

    if (pattern[i] > 0) {
      const [tokenOut] = await curve.quoteBuy(ethers.parseEther(String(amt)));
      const tx = await curveS.buy(tokenOut * 95n / 100n, { value: ethers.parseEther(String(amt)) });
      await tx.wait();
      console.log(`  +${amt} KAS buy by ${signer.address.slice(0,6)}…`);
    } else {
      // sell: needs balance. If signer has none, skip.
      const bal = await token.balanceOf(signer.address);
      if (bal === 0n) {
        console.log(`  (skip sell, ${signer.address.slice(0,6)}… empty)`);
        await bumpTime(60); continue;
      }
      const allow = await token.allowance(signer.address, coin.curve);
      const tIn = bal / BigInt(2 + i % 4);
      if (allow < tIn) {
        await (await tokenS.approve(coin.curve, ethers.MaxUint256)).wait();
      }
      const [kasOut] = await curve.quoteSell(tIn);
      if (kasOut === 0n) { console.log('  (skip 0 quote)'); await bumpTime(60); continue; }
      const tx = await curveS.sell(tIn, kasOut * 95n / 100n);
      await tx.wait();
      console.log(`  -${ethers.formatEther(tIn)} ${await token.symbol()} sell by ${signer.address.slice(0,6)}… (-> ${ethers.formatEther(kasOut)} KAS)`);
    }
    await bumpTime(60);
  }

  console.log('\n✓ chart seeded — reload http://localhost:8765/ and click PEPEW');
}

main().catch((e) => { console.error(e); process.exit(1); });

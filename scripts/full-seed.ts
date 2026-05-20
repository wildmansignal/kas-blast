import { ethers, network } from 'hardhat';

const FACTORY = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

async function bumpTime(s: number) {
  await network.provider.send('evm_increaseTime', [s]);
  await network.provider.send('evm_mine');
}

async function main() {
  const signers = await ethers.getSigners();
  const factory = await ethers.getContractAt('PumpFactory', FACTORY, signers[0]);

  // Launch PEPEW with a 2 KAS dev-buy from creator
  console.log('--- LAUNCH PEPEW with 2 KAS dev-buy ---');
  const tx = await factory.launch(
    'Pepe Warrior', 'PEPEW',
    'https://i.imgur.com/c5b3qjL.png',
    'The chaddest frog on Kaspa. Smoke test coin.',
    { value: ethers.parseEther('2.5') }
  );
  await tx.wait();
  const coin = await factory.coins(await factory.coinsLength() - 1n);
  console.log('  curve:', coin.curve);

  const curve = await ethers.getContractAt('PumpCurve', coin.curve);
  const token = await ethers.getContractAt('MemeToken', coin.token);

  await bumpTime(60);

  const pattern = [+1, +3, +2, -1, +5, +2, -3, +1, +4, -2, +6, +8, -2, +3, -4, +2, +1, -1, +5, +7];
  for (let i = 0; i < pattern.length; i++) {
    const signer = signers[1 + (i % 9)];
    const curveS = curve.connect(signer);
    const tokenS = token.connect(signer);
    const amt = Math.abs(pattern[i]);
    if (pattern[i] > 0) {
      const [out] = await curve.quoteBuy(ethers.parseEther(String(amt)));
      await (await curveS.buy(out * 95n / 100n, { value: ethers.parseEther(String(amt)) })).wait();
      console.log(`  +${amt} KAS by ${signer.address.slice(0,6)}…`);
    } else {
      const bal = await token.balanceOf(signer.address);
      if (bal === 0n) { await bumpTime(60); continue; }
      const allow = await token.allowance(signer.address, coin.curve);
      const tIn = bal / 2n;
      if (allow < tIn) await (await tokenS.approve(coin.curve, ethers.MaxUint256)).wait();
      const [kasOut] = await curve.quoteSell(tIn);
      if (kasOut === 0n) { await bumpTime(60); continue; }
      await (await curveS.sell(tIn, kasOut * 95n / 100n)).wait();
      console.log(`  sell by ${signer.address.slice(0,6)}… → ${ethers.formatEther(kasOut)} KAS`);
    }
    await bumpTime(60);
  }
  console.log('\n✓ seeded — reload http://localhost:8765/');
}

main().catch((e) => { console.error(e); process.exit(1); });

import { ethers } from 'hardhat';

const FACTORY = '0xff5A8D53fF7518fD0Dc3582b2FE1FeF8FDCF9fAB';
const DAN     = '0xAd7991700167FebC845fc70ADf16eC7fC866052B';
const FEE_BPS = 100n; // 1%
const LAUNCH_FEE = ethers.parseEther('0.5');

async function main() {
  const provider = ethers.provider;
  const factory = await ethers.getContractAt('PumpFactory', FACTORY);

  console.log('=== FEE WIRING ===');
  const feeRecipient = await factory.feeRecipient();
  const match = feeRecipient.toLowerCase() === DAN.toLowerCase();
  console.log('  factory.feeRecipient():', feeRecipient);
  console.log('  your address:          ', DAN);
  console.log('  MATCH:                 ', match ? '✓ YES — all fees route to you' : '✗ NO');

  console.log('\n=== CURRENT WALLET BALANCE ===');
  const bal = await provider.getBalance(DAN);
  console.log('  ', ethers.formatEther(bal), 'KAS');

  console.log('\n=== FEES EARNED SO FAR (computed from on-chain events) ===');
  const len = Number(await factory.coinsLength());
  console.log('  coins launched:', len);

  let launchFees = LAUNCH_FEE * BigInt(len); // every launch pays 0.5 KAS to feeRecipient
  let tradeFees = 0n;

  for (let i = 0; i < len; i++) {
    const coin = await factory.coins(i);
    const curve = await ethers.getContractAt('PumpCurve', coin.curve);
    const buys = await curve.queryFilter(curve.filters.Buy());
    const sells = await curve.queryFilter(curve.filters.Sell());
    for (const b of buys) {
      // buy fee = kasIn * feeBps / 10000  (input-side)
      tradeFees += (b.args.kasIn * FEE_BPS) / 10_000n;
    }
    for (const s of sells) {
      // sell fee = grossOut * feeBps / 10000. We can't read grossOut directly from the
      // event (it emits net kasOut), so approximate: fee ≈ kasOut * feeBps / (10000 - feeBps)
      tradeFees += (s.args.kasOut * FEE_BPS) / (10_000n - FEE_BPS);
    }
    console.log(`  coin[${i}] ${coin.curve.slice(0,10)}…: ${buys.length} buys, ${sells.length} sells`);
  }

  console.log('\n  launch fees collected:', ethers.formatEther(launchFees), 'KAS');
  console.log('  trade fees collected: ~', ethers.formatEther(tradeFees), 'KAS');
  console.log('  TOTAL fees to your wallet: ~', ethers.formatEther(launchFees + tradeFees), 'KAS');

  console.log('\n=== IMPORTANT NOTE ===');
  console.log('  You are BOTH the only trader AND the feeRecipient right now.');
  console.log('  So these fees came FROM your wallet and went back TO your wallet.');
  console.log('  Net effect on your balance ≈ -gas only.');
  console.log('  To see fees as real income, someone ELSE has to trade.');
}

main().catch(e => { console.error(e); process.exit(1); });

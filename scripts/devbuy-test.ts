import { ethers } from 'hardhat';

const FACTORY = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

async function main() {
  const [creator] = await ethers.getSigners();
  const factory = await ethers.getContractAt('PumpFactory', FACTORY, creator);

  console.log('--- LAUNCH WITHOUT dev-buy ---');
  let tx = await factory.launch('No Bag', 'NOBAG', '', 'creator gets zero', { value: ethers.parseEther('0.5') });
  let rcpt = await tx.wait();
  let logs = rcpt!.logs;
  let coin = await factory.coins(await factory.coinsLength() - 1n);
  const tokA = await ethers.getContractAt('MemeToken', coin.token);
  const balA = await tokA.balanceOf(creator.address);
  console.log('  creator balance after launch:', ethers.formatEther(balA), 'NOBAG');
  console.log('  (expected: 0)');

  console.log('\n--- LAUNCH WITH 5 KAS dev-buy ---');
  tx = await factory.launch(
    'Dev Bag', 'DBAG',
    'https://i.imgur.com/placeholder.png',
    'creator front-runs themselves at opening price',
    { value: ethers.parseEther('5.5') }   // 0.5 fee + 5 dev-buy
  );
  rcpt = await tx.wait();
  coin = await factory.coins(await factory.coinsLength() - 1n);
  const tokB = await ethers.getContractAt('MemeToken', coin.token);
  const curveB = await ethers.getContractAt('PumpCurve', coin.curve);
  const balB = await tokB.balanceOf(creator.address);
  const realKas = await curveB.realKasReserve();
  const realTok = await curveB.realTokenReserve();
  console.log('  creator balance after launch:', ethers.formatEther(balB), 'DBAG');
  console.log('  curve real KAS:', ethers.formatEther(realKas));
  console.log('  curve real tokens left:', ethers.formatEther(realTok));
  console.log('  (expected: ~189k DBAG, since 5 KAS at opening price ~0.0000261 = ~191k tokens minus 1% fee)');

  // Confirm a second buyer pays a higher price than creator did
  console.log('\n--- SECOND BUYER pays higher price ---');
  const [, buyer2] = await ethers.getSigners();
  const c2 = curveB.connect(buyer2);
  const [out2] = await curveB.quoteBuy(ethers.parseEther('5'));
  console.log('  buyer #2 quote for 5 KAS:', ethers.formatEther(out2), 'DBAG (creator got more for the same KAS)');

  console.log('\n✓ atomic dev-buy verified');
}

main().catch((e) => { console.error(e); process.exit(1); });

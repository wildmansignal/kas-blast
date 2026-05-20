import { ethers } from 'hardhat';

const FACTORY = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

async function main() {
  const [creator, buyer] = await ethers.getSigners();
  console.log('Creator:', creator.address);
  console.log('Buyer:  ', buyer.address);

  const factory = await ethers.getContractAt('PumpFactory', FACTORY, creator);

  console.log('\n--- LAUNCH ---');
  const launchFee = await factory.LAUNCH_FEE();
  const tx = await factory.launch(
    'Pepe Warrior',
    'PEPEW',
    'https://i.imgur.com/placeholder.png',
    'The chaddest frog on Kaspa.',
    { value: launchFee }
  );
  const rcpt = await tx.wait();
  console.log('  tx:', rcpt!.hash);

  const len = await factory.coinsLength();
  console.log('  coinsLength:', len.toString());

  const coin = await factory.coins(0);
  console.log('  token:', coin.token);
  console.log('  curve:', coin.curve);

  const curve = await ethers.getContractAt('PumpCurve', coin.curve, buyer);
  const token = await ethers.getContractAt('MemeToken', coin.token, buyer);

  console.log('\n  initial price:', ethers.formatEther(await curve.priceX1e18()), 'KAS/token');
  console.log('  graduation @:', ethers.formatEther(await curve.graduationKasTarget()), 'KAS');

  console.log('\n--- BUY 1 KAS ---');
  const [tokenOut, fee] = await curve.quoteBuy(ethers.parseEther('1'));
  console.log('  quote out:', ethers.formatEther(tokenOut), 'PEPEW (fee', ethers.formatEther(fee), 'KAS)');
  const buyTx = await curve.buy(tokenOut * 95n / 100n, { value: ethers.parseEther('1') });
  await buyTx.wait();
  const bal = await token.balanceOf(buyer.address);
  console.log('  buyer balance:', ethers.formatEther(bal), 'PEPEW');
  console.log('  new price:', ethers.formatEther(await curve.priceX1e18()), 'KAS/token');
  console.log('  progress:', (Number(await curve.progressBps()) / 100).toFixed(2), '%');

  console.log('\n--- SELL HALF BACK ---');
  const half = bal / 2n;
  await (await token.approve(coin.curve, ethers.MaxUint256)).wait();
  const [kasOut] = await curve.quoteSell(half);
  console.log('  quote out:', ethers.formatEther(kasOut), 'KAS');
  const sellTx = await curve.sell(half, kasOut * 95n / 100n);
  await sellTx.wait();
  console.log('  buyer balance now:', ethers.formatEther(await token.balanceOf(buyer.address)), 'PEPEW');
  console.log('  price after:', ethers.formatEther(await curve.priceX1e18()), 'KAS/token');

  console.log('\n--- BIG BUY (5000 KAS) to test graduation curve ---');
  const [out2] = await curve.quoteBuy(ethers.parseEther('5000'));
  console.log('  quote out for 5000 KAS:', ethers.formatEther(out2), 'PEPEW');
  console.log('  (not executing — too much for default 10k ETH balance)');

  console.log('\n✓ smoke test passed');
}

main().catch((e) => { console.error(e); process.exit(1); });

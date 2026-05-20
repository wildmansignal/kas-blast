import { ethers } from 'hardhat';

const FACTORY = '0xff5A8D53fF7518fD0Dc3582b2FE1FeF8FDCF9fAB';
const DAN     = '0xAd7991700167FebC845fc70ADf16eC7fC866052B';

async function main() {
  const provider = ethers.provider;
  const f = await ethers.getContractAt('PumpFactory', FACTORY);

  console.log('=== KAS BLAST live factory state ===');
  const len = await f.coinsLength();
  console.log('  coinsLength:', String(len));

  if (len === 0n) {
    console.log('  (no coins yet)');
    return;
  }

  const coin = await f.coins(0);
  console.log('\n=== coins[0] (FIRST COIN EVER on KAS BLAST) ===');
  console.log('  token  :', coin.token);
  console.log('  curve  :', coin.curve);
  console.log('  creator:', coin.creator);
  console.log('  createdAt:', new Date(Number(coin.createdAt) * 1000).toISOString());

  const token = await ethers.getContractAt('MemeToken', coin.token);
  const curve = await ethers.getContractAt('PumpCurve', coin.curve);

  const [name, sym, desc, img, totalSupply] = await Promise.all([
    token.name(), token.symbol(), token.description(), token.imageUri(), token.totalSupply()
  ]);
  console.log('\n  name        :', name);
  console.log('  symbol      :', sym);
  console.log('  description :', desc);
  console.log('  imageUri    :', img.slice(0, 80) + (img.length > 80 ? '…' : ''));
  console.log('  totalSupply :', ethers.formatEther(totalSupply));

  const [price, rkas, rtok, prog, complete] = await Promise.all([
    curve.priceX1e18(), curve.realKasReserve(), curve.realTokenReserve(),
    curve.progressBps(), curve.complete()
  ]);
  console.log('\n  price       :', ethers.formatEther(price), 'KAS / token');
  console.log('  marketCap   :', (Number(ethers.formatEther(price)) * 1e9).toFixed(2), 'KAS');
  console.log('  realKasRes  :', ethers.formatEther(rkas), 'KAS');
  console.log('  realTokRes  :', ethers.formatEther(rtok), 'BLASTOFF (in curve)');
  console.log('  progress    :', (Number(prog) / 100).toFixed(2), '%');
  console.log('  complete    :', complete);

  const danBal = await token.balanceOf(DAN);
  console.log('\n  Dan holds   :', ethers.formatEther(danBal), 'BLASTOFF');
  console.log('  Dan KAS bal :', ethers.formatEther(await provider.getBalance(DAN)), 'KAS');

  const buys = await curve.queryFilter(curve.filters.Buy());
  console.log('\n  Buy events  :', buys.length);
  buys.forEach((e, i) => {
    console.log(`    [${i}] block ${e.blockNumber}: ${e.args.trader.slice(0,6)}… +${ethers.formatEther(e.args.kasIn)} KAS → ${ethers.formatEther(e.args.tokenOut)} BLASTOFF`);
  });
}

main().catch(e => { console.error(e); process.exit(1); });

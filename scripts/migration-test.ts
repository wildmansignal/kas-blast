// Run this against a Kasplex mainnet fork:
//   FORK_KASPLEX=1 npx hardhat run scripts/migration-test.ts
//
// What it does:
//  1. Deploys our PumpFactory wired to the REAL KrokoSwap addresses on the fork
//  2. Launches a coin with a 50,000 KAS atomic dev-buy → immediately graduates
//  3. Calls migrateLP()
//  4. Verifies: LP tokens minted to 0x000...dEaD, pair has WKAS + meme tokens

import { ethers, network } from 'hardhat';

const KROKO_WKAS       = '0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e';
const KROKO_V2_FACTORY = '0x4373b7Fcf5059A785843cD224129e01d243Aef71';
const DEAD             = '0x000000000000000000000000000000000000dEaD';

const ERC20_ABI = [
  'function balanceOf(address) view returns (uint256)',
  'function totalSupply() view returns (uint256)',
];
const PAIR_ABI = [
  ...ERC20_ABI,
  'function token0() view returns (address)',
  'function token1() view returns (address)',
  'function getReserves() view returns (uint112,uint112,uint32)',
];
const V2_FACTORY_ABI = [
  'function getPair(address,address) view returns (address)',
];

async function main() {
  const [deployer] = await ethers.getSigners();
  const chain = Number((await deployer.provider!.getNetwork()).chainId);
  if (chain !== 31337) {
    throw new Error('Run via `FORK_KASPLEX=1 npx hardhat run …` so hardhat forks Kasplex mainnet.');
  }

  // Give deployer 100,000 KAS so the dev-buy clears graduation after 1% fee
  await network.provider.send('hardhat_setBalance', [
    deployer.address,
    '0x' + ethers.parseEther('100000').toString(16),
  ]);
  console.log('Deployer:', deployer.address);
  console.log('Balance: ', ethers.formatEther(await deployer.provider!.getBalance(deployer.address)), 'KAS');

  console.log('\n--- DEPLOY FACTORY (against forked Kasplex mainnet w/ real Kroko addresses) ---');
  const F = await ethers.getContractFactory('PumpFactory');
  const factory = await F.deploy(deployer.address, KROKO_WKAS, KROKO_V2_FACTORY);
  await factory.waitForDeployment();
  console.log('  PumpFactory:', await factory.getAddress());

  console.log('\n--- LAUNCH + ATOMIC 50,000 KAS DEV-BUY (graduates immediately) ---');
  const launchFee = await factory.LAUNCH_FEE();
  // 51,000 KAS so net (after 1% fee) is ~50,490 KAS — comfortably past the 50,000 graduation target
  const devBuy = ethers.parseEther('51000');
  const tx = await factory.launch('Pepe Force', 'PFORCE', 'https://i.imgur.com/x.png', 'force-graduated', { value: launchFee + devBuy });
  await tx.wait();

  const coin = await factory.coins(0);
  const curve = await ethers.getContractAt('PumpCurve', coin.curve);
  const token = await ethers.getContractAt('MemeToken', coin.token);
  const complete = await curve.complete();
  console.log('  curve.complete():', complete);
  console.log('  realKasReserve:', ethers.formatEther(await curve.realKasReserve()), 'KAS');
  console.log('  realTokenReserve:', ethers.formatEther(await curve.realTokenReserve()), 'PFORCE');

  if (!complete) throw new Error('expected graduation after 50,000 KAS dev-buy');

  console.log('\n--- MIGRATE LP ---');
  const beforePair = await curve.migratedPair();
  console.log('  migratedPair before:', beforePair);

  const migTx = await curve.migrateLP();
  const rcpt = await migTx.wait();
  console.log('  tx:', rcpt!.hash);

  const pair = await curve.migratedPair();
  console.log('  migratedPair after: ', pair);

  // Verify via KrokoSwap factory that the pair is registered
  const krokoF = new ethers.Contract(KROKO_V2_FACTORY, V2_FACTORY_ABI, deployer);
  const krokoPair = await krokoF.getPair(coin.token, KROKO_WKAS);
  console.log('  Kroko getPair():    ', krokoPair);
  if (krokoPair.toLowerCase() !== pair.toLowerCase()) throw new Error('pair mismatch');

  // Verify reserves + LP burned
  const pairC = new ethers.Contract(pair, PAIR_ABI, deployer);
  const wkasC = new ethers.Contract(KROKO_WKAS, ERC20_ABI, deployer);
  const [r0, r1] = await pairC.getReserves();
  const t0 = (await pairC.token0()).toLowerCase();
  const memeIsToken0 = t0 === coin.token.toLowerCase();
  const memeReserve = memeIsToken0 ? r0 : r1;
  const wkasReserve = memeIsToken0 ? r1 : r0;

  const totalLp = await pairC.totalSupply();
  const deadLp = await pairC.balanceOf(DEAD);
  const curveLp = await pairC.balanceOf(coin.curve);

  console.log('  meme in pair: ', ethers.formatEther(memeReserve), 'PFORCE');
  console.log('  wkas in pair: ', ethers.formatEther(wkasReserve), 'WKAS');
  console.log('  total LP:     ', ethers.formatEther(totalLp));
  console.log('  LP at 0xdEaD: ', ethers.formatEther(deadLp));
  console.log('  LP at curve:  ', ethers.formatEther(curveLp), '(should be 0 — all LP burned)');

  if (curveLp !== 0n) throw new Error('curve still holds LP — should all be at dead');
  if (deadLp === 0n) throw new Error('no LP at dead address');
  if (memeReserve === 0n || wkasReserve === 0n) throw new Error('pair reserves empty');

  console.log('\n--- ATTEMPT TO MIGRATE AGAIN (should revert) ---');
  try {
    await curve.migrateLP();
    throw new Error('expected revert');
  } catch (e: any) {
    if (e.message.includes('already migrated')) console.log('  ✓ second migrate reverted as expected');
    else throw e;
  }

  console.log('\n✓✓ LP MIGRATION VERIFIED on Kasplex mainnet fork');
  console.log('   Liquidity is locked in KrokoSwap pair', pair, '— forever, rug-proof.');
}

main().catch((e) => { console.error(e); process.exit(1); });

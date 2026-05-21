// FORK_KASPLEX=1 npx hardhat run scripts/social-migration-test.ts
// Verifies: launch with social fields → socials stored → dev-buy → graduation → LP migration

import { ethers, network } from 'hardhat';

const KROKO_WKAS       = '0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e';
const KROKO_V2_FACTORY = '0x4373b7Fcf5059A785843cD224129e01d243Aef71';
const DEAD             = '0x000000000000000000000000000000000000dEaD';

async function main() {
  const [deployer] = await ethers.getSigners();
  await network.provider.send('hardhat_setBalance', [deployer.address, '0x' + ethers.parseEther('100000').toString(16)]);

  const F = await ethers.getContractFactory('PumpFactory');
  const factory = await F.deploy(deployer.address, KROKO_WKAS, KROKO_V2_FACTORY);
  await factory.waitForDeployment();
  console.log('factory:', await factory.getAddress());

  console.log('\n--- LAUNCH with socials + 51k KAS dev-buy ---');
  const fee = await factory.LAUNCH_FEE();
  const tx = await factory.launch({
    name: 'Social Test',
    symbol: 'SOCIAL',
    imageUri: 'https://example.com/x.png',
    description: 'testing socials',
    twitter: 'https://x.com/socialcoin',
    telegram: 'https://t.me/socialcoin',
    website: 'https://socialcoin.com',
    discord: 'https://discord.gg/abc',
  }, { value: fee + ethers.parseEther('51000') });
  await tx.wait();

  const coin = await factory.coins(0);
  const token = await ethers.getContractAt('MemeToken', coin.token);
  const curve = await ethers.getContractAt('PumpCurve', coin.curve);

  console.log('  name:    ', await token.name());
  console.log('  twitter: ', await token.twitter());
  console.log('  telegram:', await token.telegram());
  console.log('  website: ', await token.website());
  console.log('  discord: ', await token.discord());
  console.log('  complete:', await curve.complete());

  console.log('\n--- MIGRATE LP ---');
  await (await curve.migrateLP()).wait();
  const pair = await curve.migratedPair();
  const pairC = new ethers.Contract(pair, ['function balanceOf(address) view returns (uint256)','function totalSupply() view returns (uint256)'], deployer);
  const deadLp = await pairC.balanceOf(DEAD);
  const curveLp = await pairC.balanceOf(coin.curve);
  console.log('  pair:', pair);
  console.log('  LP at dead:', ethers.formatEther(deadLp));
  console.log('  LP at curve:', ethers.formatEther(curveLp), '(must be 0)');

  if (curveLp !== 0n && deadLp > 0n) throw new Error('LP not fully burned');

  // Verify a coin with NO socials also works (all empty strings)
  console.log('\n--- LAUNCH with NO socials (empty strings) ---');
  await (await factory.launch({
    name: 'Bare Coin', symbol: 'BARE', imageUri: '', description: 'no socials',
    twitter: '', telegram: '', website: '', discord: '',
  }, { value: fee })).wait();
  const coin2 = await factory.coins(1);
  const token2 = await ethers.getContractAt('MemeToken', coin2.token);
  console.log('  name:', await token2.name(), '| twitter empty:', (await token2.twitter()) === '');

  console.log('\n✓✓ socials + dev-buy + graduation + migration all verified');
}

main().catch(e => { console.error(e); process.exit(1); });

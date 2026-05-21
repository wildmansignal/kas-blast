import { ethers } from 'hardhat';

const FACTORY = '0x57486Dde9A6A3F8F32805BBFA0df3bFb3b09F055';

async function main() {
  const [creator] = await ethers.getSigners();
  const factory = await ethers.getContractAt('PumpFactory', FACTORY, creator);
  const fee = await factory.LAUNCH_FEE();

  console.log('Re-launching BLASTOFF on new factory with socials + 1 KAS dev-buy...');
  const tx = await factory.launch({
    name: 'Blast Off',
    symbol: 'BLASTOFF',
    imageUri: 'https://image.pollinations.ai/prompt/rocket%20blasting%20off%20neon%20cyan%20meme%20coin?width=512&height=512&seed=42&nologo=true',
    description: 'T-minus zero. The genesis coin of KAS BLAST. Forever coins[0] in the v2 factory. 🚀',
    twitter: '',
    telegram: '',
    website: 'https://kasblast.com',
    discord: '',
  }, { value: fee + ethers.parseEther('1') });
  const rcpt = await tx.wait();
  console.log('  tx:', rcpt!.hash, 'block', rcpt!.blockNumber);

  const coin = await factory.coins(0);
  console.log('  token:', coin.token);
  console.log('  curve:', coin.curve);
  const token = await ethers.getContractAt('MemeToken', coin.token);
  console.log('  website:', await token.website());
  console.log('\n✓ BLASTOFF is coins[0] on the new factory');
}

main().catch(e => { console.error(e); process.exit(1); });

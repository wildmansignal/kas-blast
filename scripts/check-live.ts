import { ethers } from 'hardhat';
const F = '0xff5A8D53fF7518fD0Dc3582b2FE1FeF8FDCF9fAB';
async function main() {
  const f = await ethers.getContractAt('PumpFactory', F);
  console.log('  LAUNCH_FEE        :', ethers.formatEther(await f.LAUNCH_FEE()), 'KAS');
  console.log('  TOKEN_TOTAL_SUPPLY:', ethers.formatEther(await f.TOKEN_TOTAL_SUPPLY()), 'tokens');
  console.log('  GRADUATION_TARGET :', ethers.formatEther(await f.GRADUATION_KAS_TARGET()), 'KAS');
  console.log('  krokoWKAS         :', await f.krokoWKAS());
  console.log('  krokoV2Factory    :', await f.krokoV2Factory());
  console.log('  feeRecipient      :', await f.feeRecipient());
  console.log('  coinsLength       :', String(await f.coinsLength()));
}
main().catch(e => { console.error(e); process.exit(1); });

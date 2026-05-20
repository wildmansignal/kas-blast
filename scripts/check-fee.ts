import { ethers } from 'hardhat';
const F = '0xff5A8D53fF7518fD0Dc3582b2FE1FeF8FDCF9fAB';
async function main() {
  const f = await ethers.getContractAt('PumpFactory', F);
  const bps = await f.DEFAULT_FEE_BPS();
  console.log('DEFAULT_FEE_BPS on the LIVE factory:', String(bps), '=', Number(bps)/100, '%');
}
main().catch(e => { console.error(e); process.exit(1); });

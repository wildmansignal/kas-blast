// Estimates deploy gas against the forked Kasplex mainnet so we get a realistic
// number (factory embeds MemeToken + PumpCurve bytecode + viaIR optimization).

import { ethers, network } from 'hardhat';

const KROKO_WKAS       = '0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e';
const KROKO_V2_FACTORY = '0x4373b7Fcf5059A785843cD224129e01d243Aef71';

async function main() {
  const [d] = await ethers.getSigners();
  const F = await ethers.getContractFactory('PumpFactory');
  const tx = await F.getDeployTransaction(d.address, KROKO_WKAS, KROKO_V2_FACTORY);

  const est = await d.provider!.estimateGas({ ...tx, from: d.address });
  const gasPrice = await d.provider!.getFeeData();
  console.log('Estimated deploy gas:', est.toString());
  console.log('Mainnet basefee     : 2000 gwei (per Kasplex docs)');
  const costWei = est * 2000n * 10n ** 9n;
  console.log('Estimated cost      :', ethers.formatEther(costWei), 'KAS');

  // Add 20% buffer for safety
  const buffered = costWei * 120n / 100n;
  console.log('+20% buffer         :', ethers.formatEther(buffered), 'KAS');
}

main().catch(e => { console.error(e); process.exit(1); });

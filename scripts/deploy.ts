import { ethers } from 'hardhat';

// KrokoSwap on Kasplex L2 mainnet (verified via eth_getCode against evmrpc.kasplex.org)
const KROKO_WKAS_MAINNET       = '0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e';
const KROKO_V2_FACTORY_MAINNET = '0x4373b7Fcf5059A785843cD224129e01d243Aef71';

// For chains where Kroko isn't deployed yet (e.g. testnet, local hardhat without fork),
// pass address(0) and migration will revert with "kroko unset" until/if we deploy a fork.
async function main() {
  const [deployer] = await ethers.getSigners();
  const feeRecipient = process.env.FEE_RECIPIENT || deployer.address;

  const net = await deployer.provider!.getNetwork();
  const chainId = Number(net.chainId);

  let wkas: string;
  let v2Factory: string;
  if (chainId === 202555 /* Kasplex mainnet */ || process.env.FORK_KASPLEX === '1') {
    wkas = KROKO_WKAS_MAINNET;
    v2Factory = KROKO_V2_FACTORY_MAINNET;
    console.log('Using KrokoSwap mainnet addresses.');
  } else {
    wkas = ethers.ZeroAddress;
    v2Factory = ethers.ZeroAddress;
    console.log('Kroko unset (chain', chainId, ') — migrateLP() will revert until factory redeployed against a fork or mainnet.');
  }

  console.log('Deployer:    ', deployer.address);
  console.log('FeeRecipient:', feeRecipient);
  console.log('WKAS:        ', wkas);
  console.log('V2 Factory:  ', v2Factory);

  const Factory = await ethers.getContractFactory('PumpFactory');
  const factory = await Factory.deploy(feeRecipient, wkas, v2Factory);
  await factory.waitForDeployment();

  const addr = await factory.getAddress();
  console.log('\nPumpFactory deployed at:', addr);
}

main().catch((e) => { console.error(e); process.exit(1); });

import 'dotenv/config';
import { HardhatUserConfig } from 'hardhat/config';
import '@nomicfoundation/hardhat-toolbox';

const KASPLEX_L2_RPC      = process.env.KASPLEX_L2_RPC || 'https://rpc.kasplextest.xyz';
const KASPLEX_L2_CHAINID  = Number(process.env.KASPLEX_L2_CHAINID || 167012); // testnet by default
const KASPLEX_MAINNET_RPC = process.env.KASPLEX_MAINNET_RPC || 'https://evmrpc.kasplex.org';
const FORK_KASPLEX        = process.env.FORK_KASPLEX === '1';
const PRIVATE_KEY         = process.env.DEPLOYER_KEY || '';

const config: HardhatUserConfig = {
  solidity: {
    version: '0.8.20',
    settings: {
      optimizer: { enabled: true, runs: 200 },
      viaIR: true,
    },
  },
  networks: {
    hardhat: FORK_KASPLEX
      ? { forking: { url: KASPLEX_MAINNET_RPC } }
      : {},
    localhost: { url: 'http://127.0.0.1:8545' },
    kasplexL2: {
      url: KASPLEX_L2_RPC,
      chainId: KASPLEX_L2_CHAINID,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
    kasplexMainnet: {
      url: KASPLEX_MAINNET_RPC,
      chainId: 202555,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
  // Etherscan-compatible contract verification.
  // As of May 2026, explorer.kasplex.org does NOT publicly expose the Blockscout
  // verification API endpoints — both /api and /api/v2 paths 404. Once Kasplex
  // publishes their verification API, set apiURL below and run:
  //   npx hardhat verify --network kasplexMainnet 0xff5A8D53fF7518fD0Dc3582b2FE1FeF8FDCF9fAB \
  //     "0xAd7991700167FebC845fc70ADf16eC7fC866052B" \
  //     "0x2c2Ae87Ba178F48637acAe54B87c3924F544a83e" \
  //     "0x4373b7Fcf5059A785843cD224129e01d243Aef71"
  etherscan: {
    apiKey: { kasplexMainnet: 'no-api-key-needed' },
    customChains: [
      {
        network: 'kasplexMainnet',
        chainId: 202555,
        urls: {
          apiURL: 'https://explorer.kasplex.org/api',        // ← update when Kasplex publishes
          browserURL: 'https://explorer.kasplex.org',
        },
      },
    ],
  },
};

export default config;

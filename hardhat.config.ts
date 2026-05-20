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
};

export default config;

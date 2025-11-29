import "dotenv/config";
import "@nomicfoundation/hardhat-toolbox";

/** @type import('hardhat/config').HardhatUserConfig */
export default {
  solidity: {
    version: "0.8.25",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    monad: {
      type: 'http',
      url: process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz',
      chainId: 10143,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
      gasPrice: 100000000000, // 100 gwei (higher than minimum to avoid fee errors)
    },
    ethereum: {
      type: 'http',
      url: process.env.ETH_RPC_URL || 'https://mainnet.infura.io/v3/YOUR_KEY',
      chainId: 1,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    sepolia: {
      type: 'http',
      url: process.env.ETH_SEPOLIA_RPC_URL || 'https://sepolia.infura.io/v3/YOUR_KEY',
      chainId: 11155111,
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
  sourcify: {
    enabled: true,
    apiUrl: "https://sourcify-api-monad.blockvision.org/",
    browserUrl: "https://testnet.monadexplorer.com/"
  },
  etherscan: {
    enabled: false,
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts"
  },
};

require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const PRIVATE_KEY = process.env.PRIVATE_KEY || "0x0000000000000000000000000000000000000000000000000000000000000000";
const POLYGON_RPC_URL = process.env.POLYGON_RPC_URL || "https://polygon-rpc.com";
const POLYGON_AMOY_RPC_URL = process.env.POLYGON_AMOY_RPC_URL || "https://rpc-amoy.polygon.technology";
const ETHEREUM_RPC_URL = process.env.ETHEREUM_RPC_URL || "https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY";
const POLYGONSCAN_API_KEY = process.env.POLYGONSCAN_API_KEY || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: 31337,
    },
    polygon: {
      url: POLYGON_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 137,
      gasPrice: "auto",
      gas: "auto",
    },
    polygonAmoy: {
      url: POLYGON_AMOY_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 80002,
      gasPrice: "auto",
      gas: "auto",
    },
    ethereum: {
      url: ETHEREUM_RPC_URL,
      accounts: [PRIVATE_KEY],
      chainId: 1,
    },
  },
  etherscan: {
    apiKey: POLYGONSCAN_API_KEY,
    customChains: [
      {
        network: "polygonAmoy",
        chainId: 80002,
        urls: {
          apiURL: "https://api-amoy.polygonscan.com/api",
          browserURL: "https://amoy.polygonscan.com",
        },
      },
    ],
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
};

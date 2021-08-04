import { task, HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@nomiclabs/hardhat-etherscan";
import "@openzeppelin/hardhat-upgrades";
// https://github.com/ethereum-ts/TypeChain/issues/406
import "@typechain/hardhat";
import "solidity-coverage";
import "hardhat-gas-reporter";
import dotenv from "dotenv";

const privateKey = process.env.PRIVATE_KEY;

dotenv.config();

// This is a sample Hardhat task. To learn how to create your own go to
// https://hardhat.org/guides/create-task.html
task("accounts", "Prints the list of accounts", async (taskArgs, hre) => {
  const accounts = await hre.ethers.getSigners();

  for (const account of accounts) {
    console.log(account.address);
  }
});

// You need to export an object to set up your config
// Go to https://hardhat.org/config/ to learn more

const config: HardhatUserConfig & {
  typechain: { outDir: string };
  etherscan: { apiKey: string };
} = {
  defaultNetwork: "hardhat",
  solidity: "0.8.2",
  typechain: {
    outDir: "dist",
  },
  networks: {
    rinkeby: {
      url: `https://eth-rinkeby.alchemyapi.io/v2/${
        process.env.ALCHEMY_API_KEY ?? ""
      }`,
      accounts: privateKey ? [privateKey] : undefined,
    },
    polygon: {
      url: "https://rpc-mumbai.maticvigil.com",
      accounts: privateKey ? [privateKey] : undefined,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
};

export default config;

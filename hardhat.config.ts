import { task, HardhatUserConfig } from "hardhat/config";
import "@nomiclabs/hardhat-waffle";
import "@openzeppelin/hardhat-upgrades";
// https://github.com/ethereum-ts/TypeChain/issues/406
import "hardhat-local-networks-config-plugin";
import "@typechain/hardhat";
import "solidity-coverage";
import "hardhat-gas-reporter";
import dotenv from "dotenv";
import path from "path";

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

const config: HardhatUserConfig & { typechain: { outDir: string } } = {
  defaultNetwork: "hardhat",
  solidity: "0.8.4",
  typechain: {
    outDir: "dist",
  },
  localNetworksConfig: path.resolve("./networks.json"),
};

export default config;

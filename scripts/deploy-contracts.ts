// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// When running the script with `npx hardhat run <script>` you'll find the Hardhat
// Runtime Environment's members available in the global scope.
import { ethers, upgrades } from "hardhat";
import type { BridgeRegistry, BridgeProvider } from "../dist";

async function main() {
  // await run('compile');

  const registryFactory = await ethers.getContractFactory("BridgeRegistry");
  const providerFactory = await ethers.getContractFactory("BridgeProvider");

  const registry = (await upgrades.deployProxy(registryFactory, [], {
    initializer: "initialize",
  })) as BridgeRegistry;
  await registry.deployed();

  console.log("Registry deployed to:", registry.address);

  const provider = (await upgrades.deployProxy(providerFactory, [], {
    initializer: "initialize",
  })) as BridgeProvider;
  await provider.deployed();

  console.log("Provider deployed to:", registry.address);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

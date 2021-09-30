import { ethers, upgrades } from "hardhat";
import type { BridgeRegistry, BridgeProvider } from "../dist";

const REGISTRY_ID = "0x7085f413A72dCd53D001eb97971bbf25793262cC";
const PROVIDER_ID = "0x8845A98EF6580d2a109f8FcfC10cc1d6007059fc";

async function main() {
  const registryFactory = await ethers.getContractFactory("BridgeRegistry");
  const providerFactory = await ethers.getContractFactory("BridgeProvider");

  await upgrades.upgradeProxy(REGISTRY_ID, registryFactory);
  console.log("Registry upgraded");

  await upgrades.upgradeProxy(PROVIDER_ID, providerFactory);
  console.log("Provider upgraded");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

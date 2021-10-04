import { ethers, upgrades } from "hardhat";

// const PROVIDER_ID = "0x8845A98EF6580d2a109f8FcfC10cc1d6007059fc";
const PROVIDER_ID = "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9";

async function main() {
  const providerFactory = await ethers.getContractFactory("BridgeProvider");

  await upgrades.upgradeProxy(PROVIDER_ID, providerFactory);
  console.log("Provider upgraded");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

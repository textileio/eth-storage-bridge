import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import type { BridgeProvider } from "../dist/BridgeProvider";
import type { BridgeProviderV1 } from "../dist/BridgeProviderV1";

describe("Bridge Upgrades", function () {
  it("should upgrade safely and successfully", async function () {
    // const registryFactory = await ethers.getContractFactory("BridgeRegistry");
    const providerFactoryV1 = await ethers.getContractFactory(
      "BridgeProviderV1"
    );
    // Original provider
    const providerFactory = await ethers.getContractFactory("BridgeProvider");
    const providerV1 = (await upgrades.deployProxy(providerFactoryV1, [], {
      initializer: "initialize",
    })) as BridgeProviderV1;
    await providerV1.deployed();

    // Upgrade provider
    const upgraded = (await upgrades.upgradeProxy(
      providerV1.address,
      providerFactory
    )) as BridgeProvider;

    const tx = await providerV1.setApiEndpoint("blah");
    await tx.wait();

    expect(await upgraded.apiEndpoint()).to.equal("blah");
  });
});

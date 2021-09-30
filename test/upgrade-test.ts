import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import type { BridgeRegistry } from "../dist";

describe("Bridge Upgrades", function () {
  it("should upgrade safely and successfully", async function () {
    const registryFactory = await ethers.getContractFactory("BridgeRegistry");
    const providerFactory = await ethers.getContractFactory("BridgeProvider");

    const registry = await upgrades.deployProxy(registryFactory, [], {
      initializer: "initialize",
    });
    await registry.deployed();

    const provider = await upgrades.deployProxy(providerFactory, [], {
      initializer: "initialize",
    });
    await registry.deployed();

    const upgradedRegistry = (await upgrades.upgradeProxy(
      registry.address,
      registryFactory
    )) as BridgeRegistry;

    await upgrades.upgradeProxy(provider.address, providerFactory);

    const tx = await registry.addProvider(provider.address);
    await tx.wait();

    const providers = await upgradedRegistry.listProviders();
    expect(providers).to.have.lengthOf(1);
  });
});

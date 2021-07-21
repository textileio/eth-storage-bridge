import { expect } from "chai";
import { ethers, upgrades } from "hardhat";
import type { Signer } from "ethers";
import type { BridgeRegistry, BridgeProvider } from "../dist";
import { BridgeProvider__factory } from "../dist";

describe("Bridge Integration", function () {
  let external: Signer;
  let registry: BridgeRegistry;

  this.beforeAll(async () => {
    const [, , two] = await ethers.getSigners();
    external = two;
  });

  this.beforeEach(async () => {
    const registryFactory = await ethers.getContractFactory("BridgeRegistry");
    const providerFactory = await ethers.getContractFactory("BridgeProvider");

    registry = (await upgrades.deployProxy(registryFactory, [], {
      initializer: "initialize",
    })) as BridgeRegistry;
    await registry.deployed();

    const provider = (await upgrades.deployProxy(providerFactory, [], {
      initializer: "initialize",
    })) as BridgeProvider;
    await provider.deployed();

    const tx = await registry.addProvider(provider.address);
    await tx.wait();
  });

  it("...should be able to query for a provider address and connect", async () => {
    const [addr] = await registry.listProviders();
    // We can "connect" to the deployed contract using our client factory
    const provider = BridgeProvider__factory.connect(addr, external);
    const value = ethers.utils.parseUnits("500", "gwei");
    const externalAddr = await external.getAddress();
    await expect(
      provider.addDeposit(externalAddr, {
        value,
      })
    )
      .to.emit(provider, "AddDeposit")
      .withArgs(externalAddr, externalAddr, value);
  });
});

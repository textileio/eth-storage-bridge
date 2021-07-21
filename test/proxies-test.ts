import { expect } from "chai";
import { ethers, upgrades, waffle } from "hardhat";
import type { BridgeRegistry } from "../typechain/BridgeRegistry";
import type { BridgeProvider } from "../typechain/BridgeProvider";

describe("Bridge Proxies", function () {
  let provider: BridgeProvider;
  let registry: BridgeRegistry;

  this.beforeEach(async () => {
    const registryFactory = await ethers.getContractFactory("BridgeRegistry");
    const providerFactory = await ethers.getContractFactory("BridgeProvider");

    registry = (await upgrades.deployProxy(registryFactory, [], {
      initializer: "initialize",
    })) as BridgeRegistry;
    await registry.deployed();

    provider = (await upgrades.deployProxy(providerFactory, [], {
      initializer: "initialize",
    })) as BridgeProvider;
    await provider.deployed();
  });

  it("...should be able to call registry via proxy contract", async function () {
    let tx = await registry.addProvider(provider.address);

    // wait until the transaction is mined
    await tx.wait();

    expect(await registry.listProviders()).to.include(provider.address);

    tx = await registry.delProvider(provider.address);

    // wait until the transaction is mined
    await tx.wait();

    expect(await registry.listProviders()).to.be.empty;
  });

  it("...should be able to call provider via proxy contract", async function () {
    expect(await provider.hasDeposit(registry.address)).to.be.false;

    let tx = await provider.addDeposit(registry.address, {
      value: ethers.utils.parseUnits("500", "gwei"),
    });
    // wait until the transaction is mined
    await tx.wait();

    expect(await provider.hasDeposit(registry.address)).to.be.true;

    // Add 5 seconds
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);

    tx = await provider.relDeposit(registry.address);
    await tx.wait();

    expect(await provider.hasDeposit(registry.address)).to.be.false;
  });
});

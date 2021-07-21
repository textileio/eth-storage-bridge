import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import type { Signer, Overrides } from "ethers";
import type { BridgeRegistry } from "../dist/BridgeRegistry";

const BN = ethers.BigNumber;

describe("Bridge Registry", function () {
  let providerAddr: string;
  let external: Signer;
  let registry: BridgeRegistry;

  this.beforeAll(async () => {
    const [, one, two] = await ethers.getSigners();
    providerAddr = await one.getAddress();
    external = two;
  });

  this.beforeEach(async () => {
    const factory = await ethers.getContractFactory("BridgeRegistry");

    registry = (await factory.deploy()) as BridgeRegistry;
    await registry.deployed();
    // We have to manually call initialize to take ownership, whereas in the proxy version we don't
    await registry.initialize();
  });

  it("...should start with an empty provider registry", async () => {
    const providers = await registry.listProviders();
    expect(providers).to.have.lengthOf(0);
  });

  it("...should fail updating provider registry with incorrect account", async () => {
    await expect(
      registry
        .connect(external) // Use connect to use a different identity for the call
        .addProvider(providerAddr)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("...should add a new provider when called from correct account", async () => {
    // Note we do not "connect" and use default owner address
    const tx = await registry.addProvider(providerAddr);
    await tx.wait();

    const providers = await registry.listProviders();
    expect(providers).to.include(providerAddr);

    await expect(registry.addProvider(providerAddr))
      .to.emit(registry, "AddProvider")
      .withArgs(providerAddr);
  });

  it("...should fail deleting provider entry with incorrect account", async () => {
    const tx = await registry.addProvider(providerAddr);
    await tx.wait();

    await expect(
      registry.connect(external).delProvider(providerAddr)
    ).to.be.revertedWith("Ownable: caller is not the owner");
  });

  it("...should delete a provider from the registry", async () => {
    let tx = await registry.addProvider(providerAddr);
    // wait until the transaction is mined
    await tx.wait();

    let providers = await registry.listProviders();
    expect(providers).to.have.lengthOf(1);

    tx = await registry.delProvider(providerAddr);
    await tx.wait();

    await expect(registry.delProvider(providerAddr))
      .to.emit(registry, "DelProvider")
      .withArgs(providerAddr);

    // Should really wait for transaction here?
    providers = await registry.listProviders();
    expect(providers).to.have.lengthOf(0);
  });

  it("...should update an existing provider in the registry", async () => {
    let tx = await registry.addProvider(providerAddr);
    await tx.wait();

    let providers = await registry.listProviders();
    expect(providers).to.have.lengthOf(1);

    tx = await registry.addProvider(providerAddr);
    // wait until the transaction is mined
    await tx.wait();

    providers = await registry.listProviders();
    expect(providers).to.include(providerAddr);
  });

  it("...should not change balance when interacting with provider registry", async () => {
    // initialBalance should be zero
    const expectedBalance = BN.from(0);
    const initialBalance = BN.from(
      await waffle.provider.getBalance(registry.address)
    );

    expect(initialBalance.toString()).to.equal(expectedBalance.toString());

    await expect(
      registry.connect(external).addProvider(providerAddr, {
        value: ethers.utils.parseEther("1.0"),
      } as Overrides)
    ).to.be.reverted; // Non-payable method

    expect(await waffle.provider.getBalance(registry.address)).to.equal(
      initialBalance.toString()
    );

    const tx = await registry.delProvider(providerAddr);
    await tx.wait();

    expect(await waffle.provider.getBalance(registry.address)).to.equal(
      initialBalance.toString()
    );
  });

  it("...should be able to transfer ownership and have access control", async () => {
    let tx = await registry.addProvider(providerAddr);
    await tx.wait();

    const providers = await registry.listProviders();
    expect(providers).to.have.lengthOf(1);

    // Transfer ownership away from current owner
    tx = await registry.transferOwnership(await external.getAddress());
    await tx.wait();

    await expect(registry.addProvider(providerAddr)).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });
});

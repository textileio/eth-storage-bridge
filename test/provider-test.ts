import { expect } from "chai";
import { ethers, waffle } from "hardhat";
import type { Signer } from "ethers";
import type { BridgeProvider } from "../typechain/BridgeProvider";

const BN = ethers.BigNumber;

function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("Bridge Provider", function () {
  let account: string;
  let external: Signer;
  let provider: BridgeProvider;

  this.beforeAll(async () => {
    const [, one, two] = await ethers.getSigners();
    account = await one.getAddress();
    external = two;
  });

  this.beforeEach(async () => {
    const factory = await ethers.getContractFactory("BridgeProvider");

    provider = (await factory.deploy()) as BridgeProvider;
    await provider.deployed();
    // We have to manually call initialize to take ownership, whereas in the proxy version we don't
    // Additionally, all public gettable parameters (apiEndpoint etc) are initialized here
    await provider.initialize();
  });

  it("...should start with some default public parameters", async () => {
    expect(await provider.apiEndpoint()).to.equal(
      "https://broker.staging.textile.dev"
    );
    expect(await provider.providerProportion()).to.equal(0); // 0 gwei
    expect(await provider.sessionDivisor()).to.equal(
      ethers.utils.parseUnits("100", "gwei")
    ); // 100 gwei
  });

  it("...should only allow the owner to change public parameters", async () => {
    await expect(
      provider.connect(external).setApiEndpoint("noop")
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(provider.setApiEndpoint("noop")).to.not.be.reverted;
    await expect(
      provider.connect(external).setProviderProportion(0)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(provider.setProviderProportion(0)).to.not.be.reverted;
    await expect(
      provider.connect(external).setSessionDivisor(10000)
    ).to.be.revertedWith("Ownable: caller is not the owner");
    await expect(provider.setSessionDivisor(10000)).to.not.be.reverted;
  });

  it("...should require adding non-zero deposits", async () => {
    await expect(
      provider.addDeposit(account, {
        value: 0,
      })
    ).to.be.revertedWith("BridgeProvider: must include deposit > 0");

    expect(await waffle.provider.getBalance(provider.address)).to.equal(0);
  });

  it("...should only allow one deposit (per address) at a time", async () => {
    const tx = await provider.connect(external).addDeposit(account, {
      value: ethers.utils.parseUnits("500", "gwei"),
    });
    await tx.wait();

    const addr = await external.getAddress();

    // A different depositor, but same address
    await expect(
      provider.addDeposit(account, {
        value: ethers.utils.parseUnits("500", "gwei"),
      })
    ).to.be.revertedWith("BridgeProvider: account already deposited");

    // But same depositor can deposit for a different account
    await expect(() =>
      provider.connect(external).addDeposit(addr, {
        value: ethers.utils.parseUnits("500", "gwei"),
      })
    ).to.changeEtherBalance(provider, ethers.utils.parseUnits("500", "gwei"));
  });

  it("...should return correct values when checking if an account has a deposit", async () => {
    // No deposits at all yet, should default to false
    expect(await provider.hasDeposit(account)).to.be.false;

    const tx = await provider.connect(external).addDeposit(account, {
      value: ethers.utils.parseUnits("500", "gwei"),
    });
    await tx.wait();

    expect(await provider.hasDeposit(account)).to.be.true;

    await expect(provider.relDeposit(account)).to.not.emit(
      provider,
      "RelDeposit"
    );

    expect(await provider.hasDeposit(account)).to.be.true;

    // Add 5 seconds
    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);

    expect(await provider.hasDeposit(account)).to.be.false;

    // Has deposit should (still) return false after release
    await expect(() => provider.relDeposits()).to.changeEtherBalance(
      provider,
      ethers.utils.parseUnits("-500", "gwei")
    );

    expect(await provider.hasDeposit(account)).to.be.false;
  });

  it("...should release deposits and (singular) deposit correctly", async () => {
    let tx = await provider.connect(external).addDeposit(account, {
      value: ethers.utils.parseUnits("500", "gwei"),
    });
    await tx.wait();
    const addr = await external.getAddress();
    tx = await provider.connect(external).addDeposit(addr, {
      value: ethers.utils.parseUnits("500", "gwei"),
    });
    await tx.wait();

    // Should be two in the bucket
    // Add 5 seconds
    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);

    await expect(provider.relDeposit(account))
      .to.emit(provider, "RelDeposit")
      .withArgs(account, ethers.utils.parseUnits("500", "gwei"));

    // Should still be one left
    await expect(provider.relDeposits())
      .to.emit(provider, "RelDeposit")
      .withArgs(addr, ethers.utils.parseUnits("500", "gwei"));

    expect(await provider.hasDeposit(account)).to.be.false;
  });

  it("...should emit multiple events when releasing funds for multiple accounts", async () => {
    let tx = await provider.connect(external).addDeposit(account, {
      value: ethers.utils.parseUnits("500", "gwei"),
    });
    await tx.wait();
    const addr = await external.getAddress();
    tx = await provider.connect(external).addDeposit(addr, {
      value: ethers.utils.parseUnits("500", "gwei"),
    });
    await tx.wait();

    // Should be two in the bucket
    // Add 5 seconds
    await ethers.provider.send("evm_increaseTime", [6]);
    await ethers.provider.send("evm_mine", []);

    // Emit the event twice
    await expect(provider.relDeposits())
      .to.emit(provider, "RelDeposit")
      .and.to.emit(provider, "RelDeposit");
  });

  it("...should change balances in accounts accordingly", async () => {
    // initialBalance should be zero
    const expectedBalance = BN.from(0);
    const initialBalance = BN.from(
      await waffle.provider.getBalance(provider.address)
    );
    expect(initialBalance.toString()).to.equal(expectedBalance.toString());

    await expect(() =>
      provider.connect(external).addDeposit(account, {
        value: ethers.utils.parseUnits("500", "gwei"),
      })
    ).to.changeEtherBalances(
      [provider, external],
      [
        ethers.utils.parseUnits("500", "gwei"),
        ethers.utils.parseUnits("-500", "gwei"),
      ]
    );

    await expect(() => provider.relDeposits()).to.changeEtherBalance(
      external,
      0
    );

    // Add 5 seconds
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);

    await expect(() => provider.relDeposits()).to.changeEtherBalance(
      external,
      ethers.utils.parseUnits("500", "gwei")
    );
  });

  it("...should emit events for adding and releasing deposits", async () => {
    await expect(
      provider.connect(external).addDeposit(account, {
        value: ethers.utils.parseUnits("500", "gwei"),
      })
    )
      .to.emit(provider, "AddDeposit")
      .withArgs(
        await external.getAddress(),
        account,
        ethers.utils.parseUnits("500", "gwei")
      );

    await expect(provider.relDeposits()).to.not.emit(provider, "RelDeposit");

    // Add 5 seconds
    await ethers.provider.send("evm_increaseTime", [5]);
    await ethers.provider.send("evm_mine", []);

    await expect(provider.relDeposits())
      .to.emit(provider, "RelDeposit")
      .withArgs(account, ethers.utils.parseUnits("500", "gwei"));
  });

  it("...should be able to transfer ownership and have access control", async () => {
    let tx = await provider.setApiEndpoint("fake");
    await tx.wait();

    expect(await provider.apiEndpoint()).to.equal("fake");

    // Transfer ownership away from current owner
    tx = await provider.transferOwnership(await external.getAddress());
    await tx.wait();

    await expect(provider.setApiEndpoint("new")).to.be.revertedWith(
      "Ownable: caller is not the owner"
    );
  });
});

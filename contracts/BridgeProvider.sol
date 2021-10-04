// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract BridgeProvider is Initializable, OwnableUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // State

    EnumerableSetUpgradeable.AddressSet private _depositees;

    struct Deposit {
        uint256 timestamp;
        address depositor;
        uint256 value; // Storage in wei
    }

    mapping(address => Deposit) public deposits;

    /**
     * @dev Percentage of deposited funds that will be given to this provider.
     *  This is now a percentage rather than a proportion, and must be within the range [0, 100].
     *
     * Can be queried via `c.providerProportion()`.
     */
    uint256 public providerProportion;

    /**
     * @dev Divisor used to calculate session expiration.
     *
     * The session expiration is calculated as `timestamp + value / sessionDivisor`.
     * Currently, the sessionDivisor is set to 100 gwei (per second of session time).
     * Can be queried via `c.sessionDivisor()`.
     */
    uint256 public sessionDivisor;

    /**
     * @dev The off-chain upload/status RESTful API endpoint supported by this provider.
     *
     * Can be queried via `c.apiEndpoint()`.
     */
    string public apiEndpoint;

    // Upgradable

    function initialize() public initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();

        // TODO: Use this!
        providerProportion = 0;
        sessionDivisor = 100 gwei; // 1 second of session time per 100 gwei
        apiEndpoint = "https://broker.staging.textile.dev";
    }

    // Events

    event AddDeposit(
        address indexed depositee,
        address indexed depositor,
        uint256 amount
    );

    event ReleaseDeposit(
        address indexed depositee,
        address indexed depositor,
        uint256 amount
    );

    enum Status {
        Unknown,
        Batching,
        Preparing,
        Auctioning,
        DealMaking,
        Success,
        Error
    }

    event StorageUpdate(
        Status indexed status,
        string indexed minerid,
        string indexed dealid
    );

    // Public Methods

    /**
     * @dev Deposit attached funds with this provider for the given account to initiate a session.
     */
    function addDeposit(address depositee) public payable {
        require(msg.value > 0, "BridgeProvider: must include deposit > 0");
        bool added = _depositees.add(depositee);
        if (!added) {
            releaseDeposit(depositee);
            bool existing = _depositees.contains(depositee);
            require(!existing, "BridgeProvider: depositee already has deposit");
        }

        deposits[depositee] = Deposit(block.timestamp, msg.sender, msg.value);

        emit AddDeposit(depositee, msg.sender, msg.value);
    }

    function isDepositValid(
        Deposit memory d,
        uint256 t,
        uint256 div
    ) internal pure returns (bool ok) {
        return d.value > 0 && (t <= (d.timestamp + d.value / div));
    }

    /**
     * @dev Return whether the given depositee has funds deposited with this provider.
     */
    function hasDeposit(address depositee) public view returns (bool) {
        return
            isDepositValid(
                deposits[depositee],
                block.timestamp,
                sessionDivisor
            );
    }

    /**
     * @dev Release expired session associated with the given depositee.
     */
    function releaseDeposit(address depositee) public {
        Deposit memory deposit = deposits[depositee];
        if (
            deposit.value > 0 &&
            !isDepositValid(deposit, block.timestamp, sessionDivisor)
        ) {
            uint256 value = deposit.value;
            uint256 cut = (value * providerProportion) / 100;
            if (cut > 0) {
                if (value < cut) {
                    value = 0;
                } else {
                    value = value - cut;
                }
            }
            (bool sent, ) = address(deposit.depositor).call{value: value}("");
            require(sent, "BridgeProvider: error releasing funds");
            bool ok = _depositees.remove(depositee);
            require(ok, "BridgeProvider: error releasing funds");
            delete deposits[depositee];
            emit ReleaseDeposit(depositee, deposit.depositor, deposit.value);
        }
    }

    /**
     * @dev Release all expired sessions associated with this provider.
     */
    function releaseDeposits() public {
        for (uint256 i = 0; i < _depositees.length(); i++) {
            releaseDeposit(_depositees.at(i));
        }
    }

    // Access Controlled Methods

    /**
     * @dev Signal that an off-chain storage update has occured.
     */
    function storageUpdate(
        Status status,
        string memory minerid,
        string memory dealid
    ) public onlyOwner {
        StorageUpdate(status, minerid, dealid);
    }

    /**
     * @dev Update the internal session divisor that controls the timeout of storage sessions.
     */
    function setSessionDivisor(uint256 m) public onlyOwner {
        sessionDivisor = m;
    }

    /**
     * @dev Update the remote API endpoint that is reported to clients.
     */
    function setApiEndpoint(string memory a) public onlyOwner {
        apiEndpoint = a;
    }

    /**
     * @dev Update the percentrage of deposited funds that are kept by this provider.
     * Funds that were previously deposited before this update will then be subject to the new
     * percentages, so ensure this is made clear to users before updating.
     */
    function setProviderProportion(uint256 p) public onlyOwner {
        require(
            p >= 0 && p <= 100,
            "percentage must be an integer in the range [0, 100]"
        );
        providerProportion = p;
    }
}

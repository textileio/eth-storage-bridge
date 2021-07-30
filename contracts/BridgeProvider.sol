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
        address sender;
        uint256 value; // Storage in wei
    }

    mapping(address => Deposit) public deposits;

    /**
     * @dev Proportion of deposited funds that will be given to this provider.
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
        providerProportion = 0 gwei;
        sessionDivisor = 100 gwei; // 1 second of session time per 100 gwei
        apiEndpoint = "https://broker.staging.textile.dev";
    }

    // Events

    event AddDeposit(
        address indexed sender,
        address indexed account,
        uint256 amount
    );

    event RelDeposit(address indexed account, uint256 amount);

    // Public Methods

    /**
     * @dev List all addresses with funds deposited with this provider.
     */
    function listDepositees() public view returns (address[] memory) {
        address[] memory depositees = new address[](_depositees.length());
        for (uint256 i = 0; i < _depositees.length(); i++) {
            depositees[i] = _depositees.at(i);
        }
        return depositees;
    }

    /**
     * @dev Deposit attached funds with this provider for the given account to initiate a session.
     */
    function addDeposit(address account) public payable {
        require(msg.value > 0, "BridgeProvider: must include deposit > 0");
        bool ok = _depositees.add(account);
        require(ok, "BridgeProvider: account already deposited");

        deposits[account] = Deposit(block.timestamp, msg.sender, msg.value);

        emit AddDeposit(msg.sender, account, msg.value);
    }

    function isDepositValid(
        Deposit memory d,
        uint256 t,
        uint256 div
    ) internal pure returns (bool ok) {
        return d.value > 0 && (t <= (d.timestamp + d.value / div));
    }

    /**
     * @dev Return whether the given address has funds deposited with this provider.
     */
    function hasDeposit(address account) public view returns (bool) {
        return
            isDepositValid(deposits[account], block.timestamp, sessionDivisor);
    }

    /**
     * @dev Release expired session associated with the given address.
     */
    function relDeposit(address account) public {
        Deposit memory deposit = deposits[account];
        if (
            deposit.value > 0 &&
            !isDepositValid(deposit, block.timestamp, sessionDivisor)
        ) {
            (bool sent, ) = address(deposit.sender).call{value: deposit.value}(
                ""
            );
            require(sent, "BridgeProvider: error releasing funds");
            bool ok = _depositees.remove(account);
            require(ok, "BridgeProvider: error releasing funds");
            delete deposits[account];
            emit RelDeposit(account, deposit.value);
        }
    }

    /**
     * @dev Release all expired sessions associated with this provider.
     */
    function relDeposits() public {
        for (uint256 i = 0; i < _depositees.length(); i++) {
            relDeposit(_depositees.at(i));
        }
    }

    // Access Controlled Methods

    function setSessionDivisor(uint256 m) public onlyOwner {
        sessionDivisor = m;
    }

    function setApiEndpoint(string memory a) public onlyOwner {
        apiEndpoint = a;
    }

    function setProviderProportion(uint256 p) public onlyOwner {
        providerProportion = p;
    }
}

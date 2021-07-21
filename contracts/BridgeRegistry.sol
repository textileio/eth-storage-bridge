// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "hardhat/console.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/structs/EnumerableSetUpgradeable.sol";

contract BridgeRegistry is Initializable, OwnableUpgradeable {
    using EnumerableSetUpgradeable for EnumerableSetUpgradeable.AddressSet;

    // State

    EnumerableSetUpgradeable.AddressSet private _providers;

    // Upgradable

    function initialize() public initializer {
        __Context_init_unchained();
        __Ownable_init_unchained();
    }

    // Events

    event AddProvider(address indexed provider);
    event DelProvider(address indexed provider);

    // Methods

    function addProvider(address provider) public onlyOwner {
        _providers.add(provider);
        emit AddProvider(provider);
    }

    function listProviders() public view returns (address[] memory) {
        address[] memory providers = new address[](_providers.length());
        for (uint256 i = 0; i < _providers.length(); i++) {
            providers[i] = _providers.at(i);
        }
        return providers;
    }

    function delProvider(address provider) public onlyOwner {
        _providers.remove(provider);
        emit DelProvider(provider);
    }
}

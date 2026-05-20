// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MemeToken is ERC20 {
    address public immutable curve;
    string public imageUri;
    string public description;
    address public immutable creator;

    constructor(
        string memory name_,
        string memory symbol_,
        string memory imageUri_,
        string memory description_,
        address creator_,
        address curve_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        curve = curve_;
        imageUri = imageUri_;
        description = description_;
        creator = creator_;
        _mint(curve_, totalSupply_);
    }
}

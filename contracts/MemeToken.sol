// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MemeToken is ERC20 {
    address public immutable curve;
    address public immutable creator;
    string public imageUri;
    string public description;
    string public twitter;
    string public telegram;
    string public website;
    string public discord;

    struct Meta {
        string imageUri;
        string description;
        string twitter;
        string telegram;
        string website;
        string discord;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        Meta memory meta_,
        address creator_,
        address curve_,
        uint256 totalSupply_
    ) ERC20(name_, symbol_) {
        curve = curve_;
        creator = creator_;
        imageUri = meta_.imageUri;
        description = meta_.description;
        twitter = meta_.twitter;
        telegram = meta_.telegram;
        website = meta_.website;
        discord = meta_.discord;
        _mint(curve_, totalSupply_);
    }
}

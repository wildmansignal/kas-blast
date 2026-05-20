// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// Minimal Uniswap V2-compatible interfaces for KrokoSwap on Kasplex L2.
/// We only need what's required for a one-shot LP migration: create pair,
/// mint LP to a recipient (the dead address, so liquidity is locked forever).

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address pair);
    function createPair(address tokenA, address tokenB) external returns (address pair);
}

interface IUniswapV2Pair {
    function mint(address to) external returns (uint256 liquidity);
    function token0() external view returns (address);
    function token1() external view returns (address);
}

/// Wrapped native token (WKAS on Kasplex, WETH-equivalent).
interface IWETH {
    function deposit() external payable;
    function withdraw(uint256 amount) external;
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

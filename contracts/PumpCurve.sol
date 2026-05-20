// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IKrokoSwap.sol";

/// @title PumpCurve — constant-product bonding curve for one meme token, paired with native KAS.
/// @notice Ported from pump.fun's Anchor program (xy=k AMM). Single token per curve, native KAS in.
///         When real KAS reserves cross the graduation target, the curve locks and emits Graduated.
contract PumpCurve is ReentrancyGuard {
    address public immutable factory;
    address public immutable creator;
    address public token; // set once via initToken (chicken-and-egg with MemeToken constructor)

    // Virtual reserves seed the curve so initial price is non-zero with empty real reserves.
    uint256 public virtualKasReserve;
    uint256 public virtualTokenReserve;

    // Real reserves are what's actually held by the contract.
    uint256 public realKasReserve;
    uint256 public realTokenReserve;

    uint256 public immutable tokenTotalSupply;
    uint256 public immutable graduationKasTarget; // real KAS at which curve completes
    uint16  public immutable feeBps;              // input-side fee in basis points (100 = 1%)
    address public immutable feeRecipient;

    // KrokoSwap migration targets (V2 fork on Kasplex L2)
    address public immutable wkas;
    address public immutable krokoV2Factory;

    address public constant DEAD = 0x000000000000000000000000000000000000dEaD;

    bool public complete;
    bool public migrated;
    address public migratedPair;

    event Buy(address indexed trader, uint256 kasIn, uint256 tokenOut, uint256 newPriceX1e18);
    event Sell(address indexed trader, uint256 tokenIn, uint256 kasOut, uint256 newPriceX1e18);
    event Graduated(uint256 kasInCurve, uint256 tokenLeft);
    event Migrated(address indexed pair, uint256 wkasIn, uint256 tokensIn, uint256 lpToDead);

    modifier notComplete() {
        require(!complete, "curve graduated");
        _;
    }

    struct InitParams {
        address creator;
        uint256 virtualKasReserve;
        uint256 virtualTokenReserve;
        uint256 realTokenReserve;
        uint256 tokenTotalSupply;
        uint256 graduationKasTarget;
        uint16  feeBps;
        address feeRecipient;
        address wkas;
        address krokoV2Factory;
    }

    constructor(InitParams memory p) {
        require(p.feeBps <= 1000, "fee>10%");
        factory = msg.sender;
        creator = p.creator;
        virtualKasReserve = p.virtualKasReserve;
        virtualTokenReserve = p.virtualTokenReserve;
        realTokenReserve = p.realTokenReserve;
        tokenTotalSupply = p.tokenTotalSupply;
        graduationKasTarget = p.graduationKasTarget;
        feeBps = p.feeBps;
        feeRecipient = p.feeRecipient;
        wkas = p.wkas;
        krokoV2Factory = p.krokoV2Factory;
    }

    /// @notice Called once by the factory immediately after MemeToken deploy.
    function initToken(address token_) external {
        require(msg.sender == factory, "only factory");
        require(token == address(0), "already init");
        require(token_ != address(0), "zero token");
        token = token_;
    }

    // ---------- price helpers ----------

    /// @notice Spot price of 1 whole token in wei-KAS (1e18 scale).
    function priceX1e18() public view returns (uint256) {
        return (virtualKasReserve * 1e18) / virtualTokenReserve;
    }

    /// @notice How many tokens you'd get for `kasIn` (after fees), without state change.
    function quoteBuy(uint256 kasIn) public view returns (uint256 tokenOut, uint256 fee) {
        fee = (kasIn * feeBps) / 10_000;
        uint256 net = kasIn - fee;
        tokenOut = (virtualTokenReserve * net) / (virtualKasReserve + net);
        if (tokenOut > realTokenReserve) tokenOut = realTokenReserve;
    }

    /// @notice How much KAS you'd receive for `tokenIn`, without state change.
    function quoteSell(uint256 tokenIn) public view returns (uint256 kasOut, uint256 fee) {
        uint256 grossOut = (virtualKasReserve * tokenIn) / (virtualTokenReserve + tokenIn);
        fee = (grossOut * feeBps) / 10_000;
        kasOut = grossOut - fee;
        if (kasOut > realKasReserve) kasOut = realKasReserve;
    }

    // ---------- swaps ----------

    /// @notice Buy `token` with native KAS. Reverts if final amount < minTokensOut.
    function buy(uint256 minTokensOut) external payable nonReentrant notComplete {
        _buyTo(msg.sender, minTokensOut);
    }

    /// @notice Buy on behalf of `recipient`. Used by the factory to perform an
    ///         atomic dev-buy inside `launch()` so the creator gets first dibs
    ///         at the opening price with no mempool front-run window.
    function buyFor(address recipient, uint256 minTokensOut) external payable nonReentrant notComplete {
        require(recipient != address(0), "zero recipient");
        _buyTo(recipient, minTokensOut);
    }

    function _buyTo(address recipient, uint256 minTokensOut) internal {
        require(msg.value > 0, "no value");
        require(token != address(0), "not init");

        uint256 fee = (msg.value * feeBps) / 10_000;
        uint256 net = msg.value - fee;

        // xy = k => dy = y * dx / (x + dx)
        uint256 tokenOut = (virtualTokenReserve * net) / (virtualKasReserve + net);
        require(tokenOut > 0, "zero out");
        if (tokenOut > realTokenReserve) tokenOut = realTokenReserve;
        require(tokenOut >= minTokensOut, "slippage");

        virtualKasReserve   += net;
        virtualTokenReserve -= tokenOut;
        realKasReserve      += net;
        realTokenReserve    -= tokenOut;

        if (fee > 0) {
            (bool ok, ) = feeRecipient.call{value: fee}("");
            require(ok, "fee xfer");
        }

        require(IERC20(token).transfer(recipient, tokenOut), "tok xfer");

        emit Buy(recipient, msg.value, tokenOut, priceX1e18());

        if (realKasReserve >= graduationKasTarget) {
            complete = true;
            emit Graduated(realKasReserve, realTokenReserve);
        }
    }

    /// @notice Sell `tokenIn` of `token` back to the curve for native KAS.
    function sell(uint256 tokenIn, uint256 minKasOut) external nonReentrant notComplete {
        require(tokenIn > 0, "no in");
        require(token != address(0), "not init");

        uint256 grossOut = (virtualKasReserve * tokenIn) / (virtualTokenReserve + tokenIn);
        uint256 fee = (grossOut * feeBps) / 10_000;
        uint256 kasOut = grossOut - fee;
        require(kasOut > 0, "zero out");
        require(kasOut <= realKasReserve, "insuf KAS");
        require(kasOut >= minKasOut, "slippage");

        require(IERC20(token).transferFrom(msg.sender, address(this), tokenIn), "tok in");

        virtualTokenReserve += tokenIn;
        virtualKasReserve   -= grossOut;
        realTokenReserve    += tokenIn;
        realKasReserve      -= grossOut;

        if (fee > 0) {
            (bool ok, ) = feeRecipient.call{value: fee}("");
            require(ok, "fee xfer");
        }
        (bool okT, ) = msg.sender.call{value: kasOut}("");
        require(okT, "kas xfer");

        emit Sell(msg.sender, tokenIn, kasOut, priceX1e18());
    }

    // ---------- views ----------

    /// @notice Progress toward graduation, 0..10000 (basis points).
    function progressBps() external view returns (uint256) {
        if (realKasReserve >= graduationKasTarget) return 10_000;
        return (realKasReserve * 10_000) / graduationKasTarget;
    }

    // ---------- LP migration (rug-proof: LP tokens minted to 0x000...dEaD) ----------

    /// @notice After graduation, anyone may call this to migrate accumulated KAS
    ///         and the 200M held-back tokens into a KrokoSwap V2 pool. The LP
    ///         receipt tokens are minted directly to the burn address — making
    ///         the liquidity permanently locked. No creator, owner, or platform
    ///         can ever pull it.
    function migrateLP() external nonReentrant {
        require(complete, "not graduated");
        require(!migrated, "already migrated");
        require(token != address(0), "not init");
        require(krokoV2Factory != address(0) && wkas != address(0), "kroko unset");

        uint256 kasAmount = realKasReserve;
        uint256 tokenAmount = realTokenReserve;
        require(kasAmount > 0 && tokenAmount > 0, "empty");

        // Effects: zero out and mark migrated BEFORE external calls
        realKasReserve = 0;
        realTokenReserve = 0;
        migrated = true;

        // Wrap KAS → WKAS (curve now holds kasAmount WKAS)
        IWETH(wkas).deposit{value: kasAmount}();

        // Get-or-create the pair
        IUniswapV2Factory f = IUniswapV2Factory(krokoV2Factory);
        address pair = f.getPair(token, wkas);
        if (pair == address(0)) {
            pair = f.createPair(token, wkas);
        }
        migratedPair = pair;

        // Transfer assets to the pair contract
        require(IERC20(token).transfer(pair, tokenAmount), "tok->pair");
        require(IWETH(wkas).transfer(pair, kasAmount), "wkas->pair");

        // Mint LP straight to dead → liquidity locked forever
        uint256 lp = IUniswapV2Pair(pair).mint(DEAD);

        emit Migrated(pair, kasAmount, tokenAmount, lp);
    }

    receive() external payable {
        // Allow WKAS to send native back here on withdraw (not used in normal flow,
        // but standard for V2/WETH interop).
        require(msg.sender == wkas, "only wkas");
    }
}

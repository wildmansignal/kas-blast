// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./MemeToken.sol";
import "./PumpCurve.sol";

/// @title PumpFactory — single launcher that spawns (MemeToken, PumpCurve) pairs and indexes them.
contract PumpFactory {
    struct Coin {
        address token;
        address curve;
        address creator;
        uint64  createdAt;
    }

    address public owner;
    address public feeRecipient;

    // Bonding-curve presets (mirroring pump.fun's tuning, KAS-quoted).
    // 1B tokens (18 decimals). Virtual reserves chosen so:
    //  - initial price ≈ 0.000026 KAS / token  (≈ market cap $2.6k at $1/KAS)
    //  - graduates at 50,000 KAS in real reserves (the "$69k" of pump.fun, retuneable later)
    uint256 public constant TOKEN_TOTAL_SUPPLY      = 1_000_000_000 ether;
    uint256 public constant INITIAL_VIRTUAL_KAS     = 28_000 ether;          // virtual KAS seed
    uint256 public constant INITIAL_VIRTUAL_TOKENS  = 1_073_000_000 ether;   // virtual token seed
    uint256 public constant INITIAL_REAL_TOKENS     = 800_000_000 ether;     // tokens available on curve
    uint256 public constant GRADUATION_KAS_TARGET   = 50_000 ether;          // real KAS to graduate
    uint16  public constant DEFAULT_FEE_BPS         = 100;                   // 1%
    uint256 public constant LAUNCH_FEE              = 0.5 ether;             // KAS to launch a coin

    // KrokoSwap (Uniswap V2 fork) on Kasplex L2 mainnet — passed to each curve
    // for permissionless LP migration after graduation. Set once at factory
    // deploy via constructor (so the same factory works on testnet/forks too).
    address public immutable krokoWKAS;
    address public immutable krokoV2Factory;

    Coin[] public coins;
    mapping(address => uint256) public indexOfToken; // token => index+1 (0 = absent)

    event CoinLaunched(
        address indexed token,
        address indexed curve,
        address indexed creator,
        string  name,
        string  symbol,
        string  imageUri,
        string  description
    );

    constructor(address feeRecipient_, address wkas_, address v2Factory_) {
        owner = msg.sender;
        feeRecipient = feeRecipient_;
        krokoWKAS = wkas_;
        krokoV2Factory = v2Factory_;
    }

    function coinsLength() external view returns (uint256) {
        return coins.length;
    }

    struct LaunchParams {
        string name;
        string symbol;
        string imageUri;
        string description;
        string twitter;
        string telegram;
        string website;
        string discord;
    }

    /// @notice Launch a new meme coin. Caller pays LAUNCH_FEE in KAS.
    ///         Social fields are all optional — pass empty strings to omit.
    function launch(LaunchParams calldata p)
        external payable returns (address tokenAddr, address curveAddr)
    {
        require(msg.value >= LAUNCH_FEE, "launch fee");

        // 1. Deploy curve (without knowing token address yet)
        PumpCurve curve = new PumpCurve(PumpCurve.InitParams({
            creator: msg.sender,
            virtualKasReserve: INITIAL_VIRTUAL_KAS,
            virtualTokenReserve: INITIAL_VIRTUAL_TOKENS,
            realTokenReserve: INITIAL_REAL_TOKENS,
            tokenTotalSupply: TOKEN_TOTAL_SUPPLY,
            graduationKasTarget: GRADUATION_KAS_TARGET,
            feeBps: DEFAULT_FEE_BPS,
            feeRecipient: feeRecipient,
            wkas: krokoWKAS,
            krokoV2Factory: krokoV2Factory
        }));

        // 2. Deploy token, minting full supply to curve
        MemeToken token = new MemeToken(
            p.name,
            p.symbol,
            MemeToken.Meta({
                imageUri: p.imageUri,
                description: p.description,
                twitter: p.twitter,
                telegram: p.telegram,
                website: p.website,
                discord: p.discord
            }),
            msg.sender,
            address(curve),
            TOKEN_TOTAL_SUPPLY
        );

        // 3. Wire token into curve (one-shot)
        curve.initToken(address(token));

        coins.push(Coin({
            token: address(token),
            curve: address(curve),
            creator: msg.sender,
            createdAt: uint64(block.timestamp)
        }));
        indexOfToken[address(token)] = coins.length;

        // 4. Forward launch fee
        (bool ok, ) = feeRecipient.call{value: LAUNCH_FEE}("");
        require(ok, "fee xfer");

        // 5. Atomic dev-buy: any extra KAS the creator sent above LAUNCH_FEE
        //    buys tokens for them at the opening price in the SAME tx, so no
        //    sniper bot can squeeze a buy in between the deploy and the dev-buy.
        uint256 devBuyValue = msg.value - LAUNCH_FEE;
        if (devBuyValue > 0) {
            curve.buyFor{value: devBuyValue}(msg.sender, 0);
        }

        emit CoinLaunched(address(token), address(curve), msg.sender, p.name, p.symbol, p.imageUri, p.description);
        return (address(token), address(curve));
    }

    function setFeeRecipient(address newRecipient) external {
        require(msg.sender == owner, "only owner");
        feeRecipient = newRecipient;
    }

    /// @notice Paginated coin reads for the frontend (returns up to `limit` items, newest first).
    function recentCoins(uint256 offset, uint256 limit) external view returns (Coin[] memory out) {
        uint256 n = coins.length;
        if (offset >= n) return new Coin[](0);
        uint256 take = n - offset;
        if (take > limit) take = limit;
        out = new Coin[](take);
        for (uint256 i = 0; i < take; i++) {
            out[i] = coins[n - 1 - offset - i];
        }
    }
}

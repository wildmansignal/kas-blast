# KAS BLAST

pump.fun, but on **Kasplex L2** (Kaspa's EVM L2). Solidity port of the constant-product bonding-curve mechanic, paired with native KAS.

**Live at:** [kasblast.com](https://kasblast.com) *(domain pending DNS)*
**Factory:** [`0xff5A8D53fF7518fD0Dc3582b2FE1FeF8FDCF9fAB`](https://explorer.kasplex.org/address/0xff5A8D53fF7518fD0Dc3582b2FE1FeF8FDCF9fAB)

## Layout

- `contracts/MemeToken.sol` — minimal ERC-20, full supply minted to the curve at deploy.
- `contracts/PumpCurve.sol` — `xy=k` bonding curve, `buy(minOut)` / `sell(amount, minOut)`, graduates at `realKas >= GRADUATION_KAS_TARGET`.
- `contracts/PumpFactory.sol` — `launch(name, symbol, image, desc)` payable; deploys + indexes (token, curve) pairs.
- `index.html` — single-file cockpit. CDN ethers.js. Connect MetaMask/Kasware, launch a coin, buy/sell on the curve, browse the grid.

## Local dev

```bash
npm install
npx hardhat node          # local EVM
# in another terminal:
npx hardhat run scripts/deploy.ts --network localhost
```

Then open `index.html`, go to the Settings tab, paste the printed factory address (and set chain to `31337`, RPC to `http://127.0.0.1:8545`).

## Kasplex testnet deploy

```bash
cp .env.example .env
# fill DEPLOYER_KEY (and FEE_RECIPIENT if you want fees elsewhere)
npm run deploy:kasplex
```

Paste factory address into the index.html Settings tab.

## Curve tuning

In [PumpFactory.sol](contracts/PumpFactory.sol):

| Constant | Value | What it does |
|---|---|---|
| `TOKEN_TOTAL_SUPPLY` | 1,000,000,000 | tokens minted (18 dec) |
| `INITIAL_VIRTUAL_KAS` | 28,000 | virtual KAS seed — controls starting price |
| `INITIAL_VIRTUAL_TOKENS` | 1,073,000,000 | virtual token seed (matches pump.fun's seed) |
| `INITIAL_REAL_TOKENS` | 800,000,000 | tokens actually buyable on curve (rest = LP at graduation) |
| `GRADUATION_KAS_TARGET` | 50,000 | real KAS in curve that locks it for DEX migration |
| `DEFAULT_FEE_BPS` | 100 | 1% input-side fee, routed to feeRecipient |
| `LAUNCH_FEE` | 0.5 KAS | charged when calling `launch()` |

Initial price ≈ 28,000 / 1,073,000,000 ≈ **2.6e-5 KAS / token**. Adjust if KAS price moves a lot.

## What's missing for prod

- **LP migration** on graduation — `complete=true` just locks the curve; you still need to call out to a Kasplex DEX (Uniswap V2 fork) and seed the pool with the remaining `realKasReserve` + `realTokenReserve`. Stub the migrator separately.
- **Anti-bot** — first-block buy cooldown, max wallet on launch, etc.
- **Creator fees** — currently 100% of fees route to `feeRecipient`. Add an `inLineCreatorBps` split if you want pump.fun-style creator royalties.
- **Image hosting** — UI accepts a URL; you'd want IPFS upload or your own bucket.

## Credit

Bonding-curve math ported from the [pump.fun Anchor program](https://github.com/Tronzit-Veca/Pumpfun-Smart-Contract) — the `xy=k` formula and input-side fee structure are the same; reserves and KAS-native plumbing are EVM-native.

# Skatehive Wallet — API Reference

All routes live under `app/api/` and run server-side (Next.js Route Handlers). They exist to avoid CORS issues, keep API keys off the client, and add SkateHive-specific logic on top of third-party services.

---

## Portfolio

### `GET /api/portfolio/[address]`

Returns the aggregated on-chain portfolio for a given EVM address.

**Data sources (merged server-side):**
- KeepKey API (`api.keepkey.info`) — tokens across Ethereum, Base, Arbitrum, Polygon, etc.
- Alchemy NFT API — Base chain NFTs (requires `NEXT_PUBLIC_ALCHEMY_KEY`)

**Response shape:**
```json
{
  "totalNetWorth": 1234.56,
  "totalBalanceUsdTokens": 1000.00,
  "totalBalanceUSDApp": 234.56,
  "nftUsdNetWorth": { "0xabc...": "0" },
  "tokens": [ ...TokenDetail[] ],
  "nfts":   [ ...NFT[] ]
}
```

**Error behaviour:** returns `{ tokens: [], nfts: [], totalNetWorth: 0, ... }` (empty portfolio) on upstream failure. Errors are logged server-side.

---

## DAO Tokens

### `GET /api/dao/tokens/[address]`

Returns Skatehive DAO NFTs owned by an EVM address, queried via the **Nouns Builder / Goldsky** subgraph.

**Config (from `config/app.config.ts`):**
- `EXTERNAL_SERVICES.DAO_GRAPHQL_URL` — Goldsky subgraph endpoint
- `DAO_ADDRESSES.token` — Skatehive DAO token contract on Base

**Response:**
```json
{
  "nfts": [
    {
      "tokenId": "42",
      "rarityRank": null,
      "token": {
        "name": "Skatehive DAO #42",
        "medias": [{ "url": "ipfs://..." }],
        "estimatedValueEth": "0",
        "collection": {
          "name": "Skatehive DAO",
          "address": "0x...",
          "network": "base",
          "floorPriceEth": "0"
        }
      }
    }
  ]
}
```

---

## Swap — 0x Protocol

All swap routes are thin proxies to the [0x Swap API v2](https://docs.0x.org) (`allowance-holder` endpoint). The API key and affiliate fee params are injected server-side.

### Affiliate fee

SkateHive collects a **0.5% fee** (50 bps) on every ERC-20 swap when `SKATEHIVE_FEE_RECIPIENT` is set in the environment. The fee is taken from the `buyToken` (what the user receives).

| Env var | Default | Description |
|---|---|---|
| `ZEROX_API_KEY` | — | Required. From 0x dashboard. |
| `SKATEHIVE_FEE_RECIPIENT` | `""` (disabled) | Treasury wallet to receive fees. |
| `SKATEHIVE_FEE_BPS` | `50` | Fee in basis points (50 = 0.5%). Max 1000. |

### `GET /api/0x/price`

Fetches an **indicative price** (no transaction included). Used for quote previews while the user types.

Forwards all query params to `https://api.0x.org/swap/allowance-holder/price`, appending fee params if configured.

**Required params:** `chainId`, `sellToken`, `buyToken`, `sellAmount`, `taker`

**Key response fields:**
```json
{
  "buyAmount": "123456789",
  "liquidityAvailable": true,
  "issues": { "allowance": { "spender": "0x..." }, "balance": null },
  "totalNetworkFee": "1234567890000000",
  "fees": {
    "integratorFee": { "amount": "61728", "token": "0x...", "type": "volume" }
  }
}
```

### `GET /api/0x/quote`

Fetches a **firm quote** with a signed transaction ready for broadcast. Called only when the user clicks Swap.

Same params and fee injection as `/api/0x/price`.

**Key extra response fields:**
```json
{
  "transaction": {
    "to": "0x...",
    "data": "0x...",
    "value": "0",
    "gas": "210000"
  }
}
```

---

## GeckoTerminal Proxy

### `GET /api/geckoterminal`

Server-side proxy for the [GeckoTerminal API](https://www.geckoterminal.com/api) to avoid CORS errors in the browser.

**Params:** `network` (e.g. `ethereum`, `base`), `address` (token contract address)

Proxies to: `https://api.geckoterminal.com/api/v2/networks/{network}/tokens/{address}?include=top_pools`

**Used by:** `lib/utils/portfolioUtils.ts` for token price data and logo URLs.

---

## Zora Coin

### `GET /api/zora/coin`

Fetches logo, name, market cap and 24h change for a **Zora network** ERC-20 token using the `@zoralabs/coins-sdk`.

**Params:** `address` (token contract), `chainId` (default `7777777`)

**Response:**
```json
{
  "image": "https://...",
  "name": "Zora Coin Name",
  "symbol": "ZCN",
  "marketCap": 50000,
  "marketCapDelta24h": 2.5
}
```

**Used by:** `components/wallet/components/TokenLogo.tsx` to load logos for Zora tokens (with in-memory cache to avoid repeated calls per render).

---

## PIX / SkateBank Proxy

### `GET /api/pix?path=skatebank`
### `POST /api/pix?path=simulatehbd2pix`

Server-side proxy for the PIXBee / SkateBank integration server, which avoids CORS issues from a dynamically-changing ngrok URL.

**Config:**
- `PIXBEE_ENDPOINT` env var (server-only). Falls back to `NEXT_PUBLIC_PIXBEE_ENDPOINT`, then a hardcoded ngrok URL.

Set `PIXBEE_ENDPOINT` in production to a stable URL once the PIX server is deployed permanently.

---

## Caching strategy

All EVM portfolio data uses **stale-while-revalidate** via `lib/utils/localCache.ts`:

| Layer | TTL | Scope |
|---|---|---|
| `localStorage` (`skh_cache_*`) | 24 h | Cross-page-refresh |
| In-memory session cache | 5 min | Within a browser tab |

Hive account data (`useHiveAccount`) uses the same pattern with a 24 h localStorage TTL.

Forcing a refresh (the ↻ button in the wallet table) clears both layers and re-fetches all portfolios.

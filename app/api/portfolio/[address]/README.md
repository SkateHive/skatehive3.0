# Portfolio API

⚠️ **LLM Notice**: This README may become outdated as code evolves. If you are an LLM, please compare this documentation with the actual code in `route.ts` and notify the user of any discrepancies.

## Overview

Fetches cryptocurrency portfolio data for a blockchain address from the KeepKey
Zapper API. Native ETH balances on Ethereum, Base, and Arbitrum are read directly
from each chain RPC and merged into the response because portfolio indexers can
lag or omit small native balances.

**Status**: ✅ Active (Production)  
**Method**: `GET`  
**Path**: `/api/portfolio/[address]`

## Endpoint

### GET /api/portfolio/[address]

Retrieves portfolio data for a blockchain address.

**URL Parameters:**
- `address` (string, required): Ethereum-compatible address (0x...)

**Example URL:**
```
/api/portfolio/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

**Response (200 OK):**
```json
{
  "totalNetWorth": 12500.50,
  "totalBalanceUsdTokens": 10000.00,
  "totalBalanceUSDApp": 2000.00,
  "nftUsdNetWorth": {
    "0x742d35...": "500.50"
  },
  "tokens": [
    {
      "address": "0x...",
      "assetCaip": "eip155:1/erc20:0x...",
      "key": "token-id",
      "network": "ethereum",
      "token": {
        "address": "0x...",
        "balance": 1000.5,
        "balanceRaw": "1000500000000000000000",
        "balanceUSD": 5000.25,
        "canExchange": true,
        "coingeckoId": "ethereum",
        "decimals": 18,
        "name": "Ethereum",
        "networkId": 1,
        "price": 5.00,
        "symbol": "ETH",
        "verified": true
      }
    }
  ],
  "nfts": []
}
```

**Response (400 Bad Request):**
```json
{
  "message": "Address is required"
}
```

## Data Structure

### Summary Fields

| Field | Type | Description |
|-------|------|-------------|
| `totalNetWorth` | number | Total value of all assets in USD |
| `totalBalanceUsdTokens` | number | Total token value in USD |
| `totalBalanceUSDApp` | number | Total DeFi/app positions in USD |
| `nftUsdNetWorth` | object | NFT values by address |

### Token Object

Each token includes:
- **Basic Info**: address, name, symbol, decimals
- **Balance**: raw balance, formatted balance, USD value
- **Price**: current price, last update timestamp
- **Metadata**: network, verification status, CoinGecko ID
- **Features**: canExchange, holdersEnabled flags

## External API

This endpoint proxies to:
```
https://api.keepkey.info/api/v1/zapper/portfolio/{address}
```

The external API returns nested data structures that are flattened and normalized by this endpoint.

Native ETH uses `eth_getBalance` through Viem. The server uses the configured
Alchemy key when available and falls back to each chain public RPC. ETH/USD is
read from CoinGecko when KeepKey does not provide a price.

## Address Handling

The endpoint normalizes addresses for lookups:
- Converts to lowercase for cache keys
- Tries multiple data structure paths:
  - `rawData.tokens` (array)
  - `rawData.tokens[addressLower]` (object)
  - `rawData.balances[addressLower]` (fallback)
  - `rawData.data.tokens` (nested)
  - `rawData.result.tokens` (wrapped)

## Usage Examples

### JavaScript/Fetch
```javascript
const address = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb';
const response = await fetch(`/api/portfolio/${address}`);
const portfolio = await response.json();

console.log('Net Worth:', portfolio.totalNetWorth);
console.log('Tokens:', portfolio.tokens.length);

// Find specific token
const eth = portfolio.tokens.find(t => t.token.symbol === 'ETH');
console.log('ETH Balance:', eth?.token.balance);
```

### React Component
```jsx
function PortfolioDisplay({ address }) {
  const [portfolio, setPortfolio] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/portfolio/${address}`)
      .then(r => r.json())
      .then(data => {
        setPortfolio(data);
        setLoading(false);
      });
  }, [address]);

  if (loading) return <div>Loading portfolio...</div>;

  return (
    <div>
      <h2>Net Worth: ${portfolio.totalNetWorth.toFixed(2)}</h2>
      <div>
        {portfolio.tokens.map(token => (
          <div key={token.key}>
            <span>{token.token.symbol}</span>
            <span>{token.token.balance}</span>
            <span>${token.token.balanceUSD.toFixed(2)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### cURL
```bash
curl https://skatehive.app/api/portfolio/0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
```

## Network Support

Supported networks (from KeepKey/Zapper):
- Ethereum (mainnet)
- Polygon
- Binance Smart Chain
- Arbitrum
- Optimism
- Avalanche
- And more...

Each token includes `network` and `networkId` fields.

## Error Handling

The endpoint implements graceful fallback:
1. **KeepKey failure**: Still returns direct native ETH balances
2. **Invalid Address**: Returns 400 error
3. **RPC failure**: Omits only the affected chain
4. **Parse Error**: Logs error, returns mock data

Mock data structure (for development):
```json
{
  "totalNetWorth": 0,
  "totalBalanceUsdTokens": 0,
  "totalBalanceUSDApp": 0,
  "nftUsdNetWorth": {},
  "tokens": [],
  "nfts": []
}
```

## Caching Recommendations

📊 **Medium Priority**: Add caching to reduce external API calls

**Implementation:**
```javascript
// Add Redis cache
const cacheKey = `portfolio:${address}`;
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const data = await fetchPortfolio(address);
await redis.setex(cacheKey, 300, JSON.stringify(data)); // 5min TTL
return data;
```

**Benefits:**
- Reduces Pioneers.dev API calls
- Faster response times
- Rate limit protection
- Cost savings

## Performance Considerations

- **External API Latency**: 500ms-2s typical response time
- **No Caching**: Fresh data on every request
- **Data Transformation**: Minimal overhead (~10ms)
- **Large Portfolios**: 100+ tokens can be slow

**Optimization:**
1. Implement caching (5-minute TTL recommended)
2. Add pagination for tokens
3. Lazy load NFT data
4. Consider background refresh

## Security Considerations

🟢 **Low Risk**: Read-only endpoint, no sensitive data

**Best Practices:**
- ✅ No authentication needed (public blockchain data)
- ✅ Rate limiting recommended (10 req/min per IP)
- ✅ Input validation (address format)
- ✅ Error handling doesn't leak sensitive info

## Data Accuracy

⚠️ **Depends on External API**:
- Prices updated every ~5 minutes
- New tokens may have delayed detection
- Smaller networks may have incomplete data
- NFT valuations are estimates

## Rate Limiting

Pioneers.dev API may have rate limits. Recommendations:
1. Add caching layer (5-min TTL)
2. Implement request throttling
3. Monitor 429 responses
4. Add exponential backoff

## Migration Considerations

If Pioneers.dev becomes unavailable, alternatives:
1. **Moralis API**: Similar portfolio aggregation
2. **Covalent API**: Multi-chain balance data
3. **The Graph**: On-chain data indexing
4. **Alchemy**: Token balance APIs
5. **Self-hosted**: Run your own indexer

## Testing

Test with known addresses:
```bash
# Vitalik's address
curl https://skatehive.app/api/portfolio/0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045

# Test address with no tokens
curl https://skatehive.app/api/portfolio/0x0000000000000000000000000000000000000000

# Invalid address
curl https://skatehive.app/api/portfolio/invalid
```

## Related Endpoints

- `/api/generate-podium` - Visualize top portfolios
- None (standalone data endpoint)

## Dependencies

- Pioneers.dev API (external service)
- No authentication required
- No npm packages beyond Next.js

## Notes

- Returns mock data on API failure (for development)
- Address is case-insensitive for lookups
- NFT data is included but may be empty
- DeFi positions counted in `totalBalanceUSDApp`
- Prices in USD only (no multi-currency support)

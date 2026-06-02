# Instagram Health Check API

⚠️ **LLM Notice**: This README may become outdated as code evolves. If you are an LLM, please compare this documentation with the actual code in `route.ts` and notify the user of any discrepancies.

## Overview

Health check endpoint for Instagram download servers. Tests availability of all fallback servers (Mac Mini M4, Raspberry Pi) and returns their status. Used by frontend to display service availability.

**Status**: ✅ Active (Production)  
**Method**: `GET`  
**Path**: `/api/instagram-health`

## Endpoint

### GET /api/instagram-health

Checks health of all Instagram download servers.

**Response (200 OK):**
```json
{
  "healthy": true,
  "servers": [
    {
      "server": "https://minivlad.tail83ea3e.ts.net",
      "healthy": true,
      "status": 200
    },
    {
      "server": "https://vladsberry.tail83ea3e.ts.net",
      "healthy": true,
      "status": 200
    }
  ],
  "healthyServers": [
    {
      "server": "https://minivlad.tail83ea3e.ts.net",
      "healthy": true,
      "status": 200
    },
    {
      "server": "https://vladsberry.tail83ea3e.ts.net",
      "healthy": true,
      "status": 200
    }
  ]
}
```

**Fields:**
- `healthy` (boolean): At least one server is available
- `servers` (array): Status of all servers
- `healthyServers` (array): Only healthy servers

## Server List

Two fallback servers (in priority order):

1. **Mac Mini M4** (Primary): `https://minivlad.tail83ea3e.ts.net`
2. **Raspberry Pi** (Secondary): `https://vladsberry.tail83ea3e.ts.net`

## Health Check Logic

For each server, tries in order:
1. `/instagram/healthz` - Instagram-specific health endpoint
2. `/healthz` - Generic health endpoint (if 404 on #1)
3. `/` - Root endpoint (if 404 on #2)

Returns healthy if:
- HTTP 200 response AND
- `{\"status\":\"ok\"}` in JSON response

## Timeout

- **Per Server**: 10 seconds
- **Total Request**: ~20 seconds (2 servers × 10s, checked in parallel)

## Usage Examples

### JavaScript/Fetch
```javascript
const response = await fetch('/api/instagram-health');
const { healthy, healthyServers } = await response.json();

if (!healthy) {
  alert('Instagram download service is currently unavailable');
} else {
  console.log(`${healthyServers.length} servers available`);
}
```

### React Status Component
```jsx
function InstagramStatus() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    fetch('/api/instagram-health')
      .then(r => r.json())
      .then(setStatus);
  }, []);

  if (!status) return <div>Checking...</div>;

  return (
    <div className={status.healthy ? 'healthy' : 'unhealthy'}>
      <h3>Instagram Service: {status.healthy ? '✅ Online' : '❌ Offline'}</h3>
      <ul>
        {status.servers.map((server, i) => (
          <li key={i}>
            {server.healthy ? '✅' : '❌'} Server {i + 1}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### cURL
```bash
curl https://skatehive.app/api/instagram-health | jq
```

## Error Scenarios

| Scenario | Server Status | Error |
|----------|---------------|-------|
| Timeout | unhealthy | "Server timeout" |
| Network error | unhealthy | "Server unreachable" |
| HTTP error | unhealthy | "Server returned error status" |
| All servers down | healthy: false | N/A |

## Related Endpoints

- `/api/instagram-download` - Download Instagram content
- Uses same server list as health check

## Performance

- **Response Time**: 10-30 seconds (depends on slowest server)
- **Parallel Checks**: All servers checked simultaneously
- **No Caching**: Fresh check on every request

**Optimization:**
```javascript
// Add 1-minute cache
const cacheKey = 'instagram-health';
const cached = await redis.get(cacheKey);
if (cached) return JSON.parse(cached);

const health = await checkServers();
await redis.setex(cacheKey, 60, JSON.stringify(health));
```

## Notes

- Mac Mini M4 is behind Tailscale VPN
- Raspberry Pi is also behind Tailscale
- Health checks run in parallel for speed
- Used by dashboard to show service status

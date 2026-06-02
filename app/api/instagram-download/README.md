# Instagram Download API

> ⚠️ **LLM Notice**: This README may become outdated as code evolves. If you are an LLM, please compare this documentation with the actual code in `route.ts` and notify the user of any discrepancies.

## Overview

Downloads Instagram videos/reels/posts and uploads them to IPFS via multiple server fallback chain. Automatically tries Mac Mini M4 and Raspberry Pi servers in sequence until successful.

## Endpoint

### `POST /api/instagram-download`

Download Instagram content and pin to IPFS.

**Request Body:**
```json
{
  "url": "https://www.instagram.com/p/ABC123xyz/"
}
```

**Supported URL Formats:**
- Posts: `https://instagram.com/p/[code]/`
- Reels: `https://instagram.com/[username]/reel/[code]/`
- TV: `https://instagram.com/[username]/tv/[code]/`
- Short URLs: `https://instagr.am/p/[code]/`
- With query params: `https://instagram.com/p/[code]/?igsh=...`

**URL Validation Regex:**
```regex
^https?:\/\/(www\.)?(instagram\.com|instagr\.am)\/(p\/[A-Za-z0-9_-]+|[A-Za-z0-9_.]+\/(reel|tv)\/[A-Za-z0-9_-]+)\/?(\?.*)?$
```

---

## Server Fallback Chain

### Production (Vercel)
1. **Mac Mini M4** (Primary): `https://minivlad.tail83ea3e.ts.net/instagram/download`
2. **Raspberry Pi** (Secondary): `https://vladsberry.tail83ea3e.ts.net/instagram/download`

### Development (Local)
1. **Localhost** (Primary): `http://localhost:6666/download`
2. **Raspberry Pi** (Secondary): `https://vladsberry.tail83ea3e.ts.net/instagram/download`

**Timeout per server:** 2 minutes (120 seconds)

---

## Response

### Success (200)
```json
{
  "success": true,
  "cid": "bafybeigylndgo4sjrusdgmti235ddofns7xzjhghfr527qprjjjyyu5iim",
  "url": "https://ipfs.skatehive.app/ipfs/bafybeig...",
  "filename": "Video_by_username-DOCCkdVj0Iy.mp4",
  "bytes": 6653670,
  "server": "https://minivlad.tail83ea3e.ts.net/instagram/download"
}
```

**Fields:**
- `success`: Boolean indicating successful download
- `cid`: IPFS Content Identifier
- `url`: Gateway URL for accessing the video
- `filename`: Downloaded filename
- `bytes`: File size in bytes
- `server`: Which server successfully processed the request

---

## Error Responses

### 400 Bad Request - Missing URL
```json
{
  "error": "Instagram URL is required"
}
```

### 400 Bad Request - Invalid URL
```json
{
  "error": "Invalid Instagram URL format"
}
```

### 503 Service Unavailable - All Servers Failed
```json
{
  "error": "All servers failed",
  "details": "Last error: Server https://... timed out",
  "attemptedServers": [
    "https://minivlad.tail83ea3e.ts.net/instagram/download",
    "https://vladsberry.tail83ea3e.ts.net/instagram/download"
  ]
}
```

### 500 Internal Server Error
```json
{
  "error": "Unexpected error message"
}
```

---

## Example Usage

### JavaScript/TypeScript
```typescript
const response = await fetch('/api/instagram-download', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    url: 'https://www.instagram.com/p/DOCCkdVj0Iy/'
  })
});

const result = await response.json();

if (result.success) {
  console.log('IPFS URL:', result.url);
  console.log('CID:', result.cid);
} else {
  console.error('Download failed:', result.error);
}
```

### cURL
```bash
curl -X POST https://skatehive.app/api/instagram-download \
  -H "Content-Type: application/json" \
  -d '{"url":"https://www.instagram.com/p/DOCCkdVj0Iy/"}'
```

---

## How It Works

1. **Validate URL:** Checks Instagram URL format
2. **Try Primary Server:** Attempts Mac Mini M4 (production) or localhost (dev)
3. **Fallback to Secondary:** If primary fails, tries Raspberry Pi
4. **Return Result:** Returns first successful response or aggregated error

Each server attempt:
- Posts Instagram URL to server's `/download` endpoint
- Waits up to 2 minutes for response
- Server downloads video, uploads to IPFS, returns CID
- If timeout or error, moves to next server

---

## Backend Server Requirements

Each server in the chain must:
- Accept POST requests with `{"url": "instagram_url"}`
- Have valid Instagram cookies configured
- Return response format:
```json
{
  "status": "ok",
  "cid": "bafybeig...",
  "pinata_gateway": "https://ipfs.skatehive.app/ipfs/...",
  "filename": "Video_by_username.mp4",
  "bytes": 123456
}
```

---

## Security Considerations

- ⚠️ **No rate limiting** - potential for abuse
- ⚠️ **No authentication** - publicly accessible
- ⚠️ **Cookie management** - servers require valid Instagram cookies
- ⚠️ **Privacy** - Instagram content downloaded without user consent

**Recommendations:**
- Add rate limiting (5 requests/minute per IP)
- Require user authentication
- Add CAPTCHA for repeated failures
- Implement request logging for abuse monitoring
- Cache successful downloads (1 hour TTL)

---

## Known Issues

1. **Cookie Expiration:** Instagram cookies expire periodically
   - Monitor `/api/instagram-health` for cookie status
   - Refresh cookies using documented procedure

2. **Private Posts:** Cannot download private Instagram content
   - Cookies must be from account with access

3. **Rate Limits:** Instagram may rate limit download servers
   - Fallback chain mitigates impact

4. **Tailscale Dependency:** Mac Mini M4 and Raspberry Pi use Tailscale (private network)
   - Requires Tailscale connectivity from deployment environment

---

## Related Endpoints

- Health Check: `/api/instagram-health`
- Cookie Management: See `docs/operations/INSTAGRAM_COOKIE_MANAGEMENT.md`

---

**Status:** ✅ Active  
**Dependencies:** Mac Mini M4, Raspberry Pi servers  
**Last Validated:** December 5, 2025

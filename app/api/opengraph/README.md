# OpenGraph Data Fetcher API

⚠️ **LLM Notice**: This README may become outdated as code evolves. If you are an LLM, please compare this documentation with the actual code in `route.ts` and notify the user of any discrepancies.

## Overview

Fetches OpenGraph metadata from external URLs for link previews. Extracts title, description, image, and site name by parsing HTML content. Used by `components/shared/OpenGraphPreview.tsx` to render link-preview cards.

**Status**: ✅ Active (SSRF-hardened)
**Method**: `GET`
**Path**: `/api/opengraph`

## Endpoint

### GET /api/opengraph

Fetches OpenGraph metadata from a provided URL.

**Query Parameters:**
- `url` (string, required): The URL to fetch OpenGraph data from. Must be `https`, and the host must resolve to a public IP.

**Example URL:**
```
/api/opengraph?url=https://skatehive.app/post/some-article
```

**Response (200 OK):**
```json
{
  "title": "Article Title",
  "description": "Article description...",
  "image": "https://example.com/image.jpg",
  "url": "https://example.com/article",
  "siteName": "example.com"
}
```

**Response (400 Bad Request):**
```json
{ "error": "URL parameter is required" }
```
or, when the guard rejects the URL:
```json
{ "error": "Only https URLs are allowed" }
{ "error": "Host is not allowed" }
{ "error": "Host could not be resolved" }
```

**Response (429 Too Many Requests):** rate limit exceeded for the caller's IP.

## Data Extraction

The endpoint extracts the following OpenGraph properties:

1. **Title**: Looks for `og:title` meta tag, falls back to `<title>` tag
2. **Description**: Looks for `og:description`, falls back to `description` meta tag
3. **Image**: Extracts `og:image`, handles relative URLs
4. **Site Name**: Extracts `og:site_name`, falls back to hostname

### Image URL Handling

The endpoint automatically resolves relative image URLs:
- `/image.jpg` → `https://example.com/image.jpg`
- `//cdn.example.com/image.jpg` → `https://cdn.example.com/image.jpg`
- Absolute URLs are used as-is

## Security

### SSRF protection (`lib/utils/publicUrlGuard.ts`)

Every request runs through `assertPublicHttpsUrl` before any fetch happens:

1. **https only** — `http:` and every other scheme are rejected.
2. **Public host only** — the hostname is checked against a block-list, then (if it isn't a literal IP) resolved via DNS and every returned address is checked too. Blocked:
   - `localhost`, and any hostname ending in `.internal` or `.local`
   - IPv4: `0.0.0.0/8`, `10.0.0.0/8`, `100.64.0.0/10` (CGNAT), `127.0.0.0/8`, `169.254.0.0/16` (link-local / cloud metadata, e.g. `169.254.169.254`), `172.16.0.0/12`, `192.168.0.0/16`, `224.0.0.0/4` (multicast), `240.0.0.0/4` (reserved)
   - IPv6: `::1`, `fc00::/7` (unique local), `fe80::/10` (link-local), and IPv4-mapped (`::ffff:a.b.c.d`) addresses in any of the above IPv4 ranges
   - Bracketed IPv6 literals in the URL (`https://[::1]/...`) are unwrapped before this check, so they can't slip through as an unrecognized hostname.
3. **DNS rebinding is closed, not just detected** — the guard's DNS answer is the address the actual request connects to. `assertPublicHttpsUrl` returns the exact IP it validated, and `fetchPinned()` in `route.ts` pins the outbound TCP connection to that IP via a custom `https.Agent({ lookup })`, while the `Host` header / TLS SNI stay the original hostname. Without this, the guard's lookup and the real request's lookup would be two separate DNS queries — an attacker's DNS server can answer differently a few milliseconds apart (return a public IP for the first, private for the second) and sail straight through a guard that only checks the hostname up front.
4. **No redirects followed** — the pinned request is issued via `node:https` directly (not `fetch`, which doesn't expose a way to pin the resolved address without depending on the `undici` package, not installed here); a 3xx response is treated as a failure (falls back to basic URL-derived data) rather than being chased to wherever it points.
5. **5 second timeout** on the pinned socket.
6. **512KB response cap** — the body is read as a stream and truncated at 512KB, so a huge or slow-drip response can't tie up the function.

### Rate limiting

`lib/utils/rate-limiter.ts`, 20 requests/minute per client IP (`getClientIP`). Exceeding it returns 429.

### Response caching

`Cache-Control: public, s-maxage=3600` on every response (including the fallback), so repeated previews of the same URL are served from the CDN edge instead of re-fetching.

## Fallback Behavior

If the target fetch fails (network error, non-2xx, redirect, timeout, or the body cap kicks in mid-parse), the endpoint returns basic information derived from the URL itself instead of an error, so the UI still has something to render:
```json
{
  "title": "example.com",
  "description": "https://example.com/article",
  "url": "https://example.com/article",
  "siteName": "example.com"
}
```
A rejected URL (bad protocol, disallowed host, unresolvable host) is a genuine 400 — the guard is meant to be a hard stop, not something to fall back past.

## Usage Examples

### JavaScript/Fetch
```javascript
const url = encodeURIComponent('https://skatehive.app/article');
const response = await fetch(`/api/opengraph?url=${url}`);
const metadata = await response.json();

console.log('Title:', metadata.title);
console.log('Image:', metadata.image);
```

### cURL
```bash
curl "https://skatehive.app/api/opengraph?url=https://example.com/article"
```

## Tests

`lib/utils/__tests__/publicUrlGuard.test.ts` (`pnpm test:public-url-guard`) covers the host validator: a public IP/hostname is allowed, each blocked IPv4/IPv6 range is rejected, `localhost` and `.internal`/`.local` hostnames are rejected, non-https protocols are rejected.

## Related

`app/api/og-debug` (a raw-HTML SSRF proxy backing an internal-only `/og-debug` debug page, no allow-list, no auth) has been **removed** — it had no code or UI reference calling it.

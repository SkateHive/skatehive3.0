# Video Proxy API

> ⚠️ **LLM Notice**: This README may become outdated as code evolves. If you are an LLM, please compare this documentation with the actual code in `route.ts` and notify the user of any discrepancies.

## Overview

CORS proxy endpoint for video transcoding services. Allows client-side applications to bypass CORS restrictions when communicating with video transcoding APIs.

## Endpoints

### `GET /api/video-proxy`

Proxy GET requests to video transcoding services.

**Query Parameters:**
- `endpoint` (string, optional): Relative endpoint path (e.g., `/healthz`, `/stats`)
- `url` (string, optional): Full target URL to proxy (alternative to endpoint)

**Example:**
```bash
# Using endpoint parameter
GET /api/video-proxy?endpoint=/healthz

# Using full URL
GET /api/video-proxy?url=https://146-235-239-243.sslip.io/healthz
```

**Response:**
- Proxied JSON response from target service
- Status code matches upstream service
- CORS headers added automatically

**Timeout:** 10 seconds

---

### `POST /api/video-proxy`

Proxy POST requests (typically file uploads) to video transcoding services.

**Query Parameters:**
- `endpoint` (string, optional): Relative endpoint path
- `url` (string, optional): Full target URL to proxy

**Body:** 
- `multipart/form-data` (FormData object)

**Example:**
```javascript
const formData = new FormData();
formData.append('video', videoFile);
formData.append('creator', 'username');

fetch('/api/video-proxy?endpoint=/transcode', {
  method: 'POST',
  body: formData
});
```

**Response:**
- Proxied JSON response from target service
- Status code matches upstream service

**Timeout:** 5 minutes (300 seconds) for large file uploads

---

### `OPTIONS /api/video-proxy`

CORS preflight handler.

**Response:**
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type
```

---

## Default Target

When using `endpoint` parameter without `url`, requests proxy to:
```
https://transcode.skatehive.app
```

## Error Handling

**400 Bad Request:**
```json
{
  "error": "Missing endpoint or url parameter"
}
```

**500 Internal Server Error:**
```json
{
  "error": "Proxy request failed"
}
```

**Timeout:**
```json
{
  "error": "AbortError: The operation was aborted"
}
```

---

## Use Cases

1. **Health Checks:** Proxy health check requests from client
2. **Video Stats:** Fetch transcoding statistics
3. **File Uploads:** Upload videos through proxy to bypass CORS
4. **Fallback Service:** When direct API access is blocked by CORS

---

## Security Considerations

- ⚠️ Currently allows proxying to any URL (potential SSRF risk)
- ✅ CORS headers properly configured
- ⚠️ No rate limiting implemented
- ⚠️ No authentication required

**Recommendations:**
- Add URL whitelist for allowed proxy targets
- Implement rate limiting
- Add request size validation
- Consider removing if CORS can be configured on origin servers

---

## Related Services

- Oracle Transcoder (Primary): `https://transcode.skatehive.app`
- Mac Mini M4 Transcoder (Secondary): `https://minivlad.tail83ea3e.ts.net/video`

---

**Status:** ✅ Active  
**Last Validated:** December 5, 2025

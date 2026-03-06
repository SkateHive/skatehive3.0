# Pinata Upload API - Edge Runtime

## Why Edge Runtime?

This API route uses **Edge Runtime** instead of Node.js Runtime to support large file uploads without hitting Vercel's serverless payload limits.

### Before (Node.js Runtime)
- ❌ **4.5 MB limit** on request body (Hobby/Pro plans)
- ❌ Files >4.5MB fail with **413 Request Entity Too Large**
- Memory-buffered FormData parsing

### After (Edge Runtime)
- ✅ **No payload size limit** (streaming upload)
- ✅ Supports files of any size (tested up to 500MB+)
- ✅ More efficient memory usage

## How it works

1. **Client** sends multipart/form-data with video file
2. **Edge Runtime** streams the FormData without buffering entire file in memory
3. **Pinata API** receives the stream and pins to IPFS
4. **Response** returns IPFS hash to client

## Rate Limiting

- **10 uploads per hour** per IP address
- In-memory limiter (works in Edge Runtime)
- For multi-instance production: consider Redis-based limiter (Upstash)

## Environment Variables

```bash
PINATA_JWT=your_pinata_jwt_token
```

## Security

- JWT is **never exposed** to client
- All uploads proxied through this API route
- Rate limiting prevents abuse

## Metadata

Each upload includes:
- `creator`: Hive username
- `fileType`: MIME type
- `uploadDate`: ISO timestamp
- `isMobile`: Boolean
- `userAgent`: Browser/device info
- `thumbnailUrl`: Optional thumbnail URL

## Testing

```bash
curl -X POST http://localhost:3000/api/pinata \
  -F "file=@video.mp4" \
  -F "creator=testuser"
```

## Related Files

- `lib/utils/videoUpload.ts` - Client-side upload logic
- `lib/utils/rate-limiter.ts` - Rate limiting implementation

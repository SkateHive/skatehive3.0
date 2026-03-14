import { NextRequest, NextResponse } from "next/server";
import { uploadLimiter, getClientIP } from '@/lib/utils/rate-limiter';
import { logUpload } from '@/lib/utils/upload-logger';

// Edge Runtime — no payload size limit (fixes 413 for large mobile uploads)
export const runtime = 'edge';

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const ip = getClientIP(request);
    const { allowed, remaining, resetIn } = uploadLimiter.check(ip);

    if (!allowed) {
        logUpload({ status: 'rate-limited', route: 'pinata-mobile', ip });
        return NextResponse.json(
            {
                error: 'Upload rate limit exceeded. Please try again later.',
                retryAfter: Math.ceil(resetIn / 1000)
            },
            {
                status: 429,
                headers: {
                    'Retry-After': Math.ceil(resetIn / 1000).toString(),
                    'X-RateLimit-Remaining': remaining.toString(),
                }
            }
        );
    }

    const pinataJwt = process.env.PINATA_JWT;
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!pinataJwt) {
        logUpload({ status: 'failed', route: 'pinata-mobile', ip, error: 'PINATA_JWT missing', userAgent });
        return NextResponse.json({ error: 'Pinata credentials not configured' }, { status: 500 });
    }

    try {
        const requestFormData = await request.formData();
        const file = requestFormData.get('file') as File;
        const creator = requestFormData.get('creator') as string;
        const thumbnailUrl = requestFormData.get('thumbnailUrl') as string;

        if (!file) {
            logUpload({ status: 'failed', route: 'pinata-mobile', ip, error: 'No file provided', userAgent });
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        const fileSizeMB = Math.round(file.size / 1024 / 1024 * 100) / 100;

        // Mobile file size check (135MB limit)
        if (file.size > 135 * 1024 * 1024) {
            logUpload({
                status: 'failed',
                route: 'pinata-mobile',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                creator,
                ip,
                platform: 'mobile',
                error: `File too large: ${fileSizeMB}MB (max 135MB)`,
                httpStatus: 413,
                userAgent,
            });
            return NextResponse.json({
                error: `File too large for mobile upload. Size: ${fileSizeMB}MB, Maximum: 135MB`
            }, { status: 413 });
        }

        logUpload({
            status: 'started',
            route: 'pinata-mobile',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            creator,
            ip,
            platform: 'mobile',
            userAgent,
        });

        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        const pinataMetadata = JSON.stringify({
            name: `mobile_${file.name}`,
            keyvalues: {
                creator: creator || 'anonymous',
                fileType: file.type,
                uploadDate: new Date().toISOString(),
                platform: 'mobile',
                userAgent: userAgent.substring(0, 100),
                fileSize: file.size.toString(),
                ...(thumbnailUrl && { thumbnailUrl }),
            }
        });
        uploadFormData.append('pinataMetadata', pinataMetadata);

        const pinataOptions = JSON.stringify({ cidVersion: 1 });
        uploadFormData.append('pinataOptions', pinataOptions);

        // Edge Runtime handles streaming — no AbortController timeout needed for body limit
        // but we still want a safety timeout for very slow uploads
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 600000); // 10 minutes

        const uploadResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${pinataJwt}` },
            body: uploadFormData,
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            logUpload({
                status: 'failed',
                route: 'pinata-mobile',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                creator,
                ip,
                platform: 'mobile',
                error: errorText,
                httpStatus: uploadResponse.status,
                durationMs: Date.now() - startTime,
                userAgent,
            });
            return NextResponse.json({
                error: `Mobile upload failed: ${uploadResponse.status} - ${errorText}`,
                status: uploadResponse.status
            }, { status: uploadResponse.status });
        }

        const upload = await uploadResponse.json();

        logUpload({
            status: 'success',
            route: 'pinata-mobile',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            creator,
            ip,
            platform: 'mobile',
            ipfsHash: upload.IpfsHash,
            durationMs: Date.now() - startTime,
            userAgent,
        });

        return NextResponse.json({
            IpfsHash: upload.IpfsHash,
            PinSize: upload.PinSize,
            Timestamp: upload.Timestamp || new Date().toISOString(),
            platform: 'mobile'
        });
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            logUpload({
                status: 'failed',
                route: 'pinata-mobile',
                ip,
                platform: 'mobile',
                error: 'Upload timeout (10min)',
                httpStatus: 408,
                durationMs: Date.now() - startTime,
                userAgent,
            });
            return NextResponse.json({ error: 'Mobile upload timeout' }, { status: 408 });
        }

        logUpload({
            status: 'failed',
            route: 'pinata-mobile',
            ip,
            platform: 'mobile',
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
            userAgent,
        });
        return NextResponse.json({ error: 'Mobile upload failed' }, { status: 500 });
    }
}

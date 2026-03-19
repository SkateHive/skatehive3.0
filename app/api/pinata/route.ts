import { NextRequest, NextResponse } from 'next/server';
import { uploadLimiter, getClientIP } from '@/lib/utils/rate-limiter';
import { logUpload } from '@/lib/utils/upload-logger';
import { groupIdForMimeType } from '@/lib/pinata/groups';

// Enable Edge Runtime for streaming support (no payload size limit)
export const runtime = 'edge';

export async function POST(request: NextRequest) {
    const startTime = Date.now();
    const ip = getClientIP(request);
    const { allowed, remaining, resetIn } = uploadLimiter.check(ip);

    if (!allowed) {
        logUpload({ status: 'rate-limited', route: 'pinata', ip });
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
    const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);

    if (!pinataJwt) {
        logUpload({ status: 'failed', route: 'pinata', ip, error: 'PINATA_JWT missing', userAgent });
        return NextResponse.json({ error: 'Pinata credentials not configured' }, { status: 500 });
    }

    try {
        const requestFormData = await request.formData();
        const file = requestFormData.get('file') as File;
        const creator = requestFormData.get('creator') as string;
        const thumbnailUrl = requestFormData.get('thumbnailUrl') as string;

        if (!file) {
            logUpload({ status: 'failed', route: 'pinata', ip, error: 'No file provided', userAgent });
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        logUpload({
            status: 'started',
            route: 'pinata',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            creator,
            ip,
            platform: isMobile ? 'mobile' : 'desktop',
            userAgent,
        });

        // Upload file using Pinata API (Edge Runtime handles streaming automatically)
        const uploadFormData = new FormData();
        uploadFormData.append('file', file);

        const groupId = groupIdForMimeType(file.type);

        const pinataMetadata = JSON.stringify({
            name: file.name,
            keyvalues: {
                source: 'webapp',
                creator: creator || 'anonymous',
                fileType: file.type,
                uploadDate: new Date().toISOString(),
                isMobile: isMobile.toString(),
                userAgent: userAgent.substring(0, 100),
                ...(thumbnailUrl && { thumbnailUrl }),
            }
        });
        uploadFormData.append('pinataMetadata', pinataMetadata);

        const pinataOptions = JSON.stringify({
            cidVersion: 1,
            ...(groupId && { groupId }),
        });
        uploadFormData.append('pinataOptions', pinataOptions);

        const uploadResponse = await fetch('https://api.pinata.cloud/pinning/pinFileToIPFS', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${pinataJwt}` },
            body: uploadFormData,
        });

        if (!uploadResponse.ok) {
            const errorText = await uploadResponse.text();
            logUpload({
                status: 'failed',
                route: 'pinata',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                creator,
                ip,
                platform: isMobile ? 'mobile' : 'desktop',
                error: errorText,
                httpStatus: uploadResponse.status,
                durationMs: Date.now() - startTime,
                userAgent,
            });

            if (uploadResponse.status === 413) {
                return NextResponse.json(
                    { error: 'File too large for IPFS pinning service' },
                    { status: 413 }
                );
            }

            throw new Error(`Pinata upload failed: ${uploadResponse.status} - ${errorText}`);
        }

        const upload = await uploadResponse.json();

        logUpload({
            status: 'success',
            route: 'pinata',
            fileName: file.name,
            fileSize: file.size,
            fileType: file.type,
            creator,
            ip,
            platform: isMobile ? 'mobile' : 'desktop',
            ipfsHash: upload.IpfsHash,
            durationMs: Date.now() - startTime,
            userAgent,
        });

        return NextResponse.json({
            IpfsHash: upload.IpfsHash,
            PinSize: upload.PinSize,
            Timestamp: upload.Timestamp || new Date().toISOString(),
        });
    } catch (error) {
        logUpload({
            status: 'failed',
            route: 'pinata',
            ip,
            error: error instanceof Error ? error.message : String(error),
            durationMs: Date.now() - startTime,
            platform: isMobile ? 'mobile' : 'desktop',
            userAgent,
        });
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

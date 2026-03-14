import { NextRequest, NextResponse } from 'next/server';
import { HIVE_CONFIG } from '@/config/app.config';
import { uploadLimiter, getClientIP } from '@/lib/utils/rate-limiter';
import { logUpload } from '@/lib/utils/upload-logger';

/**
 * API route to proxy image uploads to images.hive.blog
 * Solves CORS issues when uploading from client-side
 */
export async function POST(request: NextRequest) {
  const startTime = Date.now();
  const ip = getClientIP(request);
  const { allowed, remaining, resetIn } = uploadLimiter.check(ip);

  if (!allowed) {
    logUpload({ status: 'rate-limited', route: 'upload-image', ip });
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

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File;
    const signature = formData.get('signature') as string;

    if (!file || !signature) {
      logUpload({ status: 'failed', route: 'upload-image', ip, error: 'Missing file or signature' });
      return NextResponse.json(
        { error: 'Missing file or signature' },
        { status: 400 }
      );
    }

    // Validate file size (max 15MB)
    const maxSize = 15 * 1024 * 1024;
    if (file.size > maxSize) {
      logUpload({
        status: 'failed',
        route: 'upload-image',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        ip,
        error: 'File too large (max 15MB)',
        httpStatus: 413,
      });
      return NextResponse.json(
        { error: 'File too large. Maximum size: 15MB' },
        { status: 413 }
      );
    }

    logUpload({
      status: 'started',
      route: 'upload-image',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      ip,
    });

    // Convert File to Buffer for proper handling in Node.js environment
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const blob = new Blob([buffer], { type: file.type });

    const hiveFormData = new FormData();
    hiveFormData.append('file', blob, file.name);

    const uploadUrl = `https://images.hive.blog/${HIVE_CONFIG.APP_ACCOUNT}/${signature}`;

    const uploadResponse = await fetch(uploadUrl, {
      method: 'POST',
      body: hiveFormData,
    });

    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      logUpload({
        status: 'failed',
        route: 'upload-image',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        ip,
        error: `Hive upload failed: ${uploadResponse.status} - ${errorText}`,
        httpStatus: uploadResponse.status,
        durationMs: Date.now() - startTime,
      });

      return NextResponse.json(
        {
          error: `Upload to Hive failed: ${uploadResponse.status}`,
          details: errorText,
          uploadUrl
        },
        { status: uploadResponse.status }
      );
    }

    const result = await uploadResponse.json();

    logUpload({
      status: 'success',
      route: 'upload-image',
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      ip,
      imageUrl: result.url,
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(result);
  } catch (error) {
    logUpload({
      status: 'failed',
      route: 'upload-image',
      ip,
      error: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - startTime,
    });

    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}

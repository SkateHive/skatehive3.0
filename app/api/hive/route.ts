/**
 * Hive API Proxy
 * 
 * Proxies requests to api.hive.blog to avoid CORS issues
 * Client → /api/hive → api.hive.blog (server-side, no CORS)
 */

import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Forward to Hive API
    const response = await fetch('https://api.hive.blog', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    const data = await response.json();
    
    return NextResponse.json(data);
  } catch (error) {
    console.error('Hive API proxy error:', error);
    return NextResponse.json(
      { error: 'Failed to proxy Hive API request' },
      { status: 500 }
    );
  }
}

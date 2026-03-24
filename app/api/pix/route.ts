import { NextRequest, NextResponse } from "next/server";

const PIXBEE_BASE =
  process.env.PIXBEE_ENDPOINT ||
  process.env.NEXT_PUBLIC_PIXBEE_ENDPOINT ||
  "https://aphid-glowing-fish.ngrok-free.app";

const NGROK_HEADERS = {
  "ngrok-skip-browser-warning": "69420",
  "Content-Type": "application/json",
};

/**
 * GET /api/pix?path=skatebank
 * POST /api/pix?path=simulatehbd2pix  (or simulatehive2pix)
 *
 * Server-side proxy for the PIXBee/SkateBank server to avoid CORS issues.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "skatebank";

  try {
    const response = await fetch(`${PIXBEE_BASE}/${path}`, {
      headers: NGROK_HEADERS,
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `PIXBee error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to fetch PIX data" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "simulatehbd2pix";

  try {
    const body = await request.json();
    const response = await fetch(`${PIXBEE_BASE}/${path}`, {
      method: "POST",
      headers: NGROK_HEADERS,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `PIXBee error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || "Failed to post PIX data" },
      { status: 500 }
    );
  }
}

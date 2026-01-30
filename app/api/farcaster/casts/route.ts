import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const fid = searchParams.get("fid");
  const limit = searchParams.get("limit") || "25";

  if (!fid) {
    return NextResponse.json(
      { error: "FID parameter is required" },
      { status: 400 }
    );
  }

  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Neynar API key not configured" },
      { status: 500 }
    );
  }

  try {
    const url = `https://api.neynar.com/v2/farcaster/feed/user/casts?fid=${fid}&limit=${limit}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        api_key: apiKey,
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    });

    if (!response.ok) {
      console.error(
        `Neynar API error: ${response.status} ${response.statusText}`
      );
      return NextResponse.json(
        { error: `Neynar API error: ${response.statusText}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      casts: data.casts || [],
      next: data.next || null,
    });
  } catch (error) {
    console.error("Error fetching Farcaster casts:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Failed to fetch casts",
      },
      { status: 500 }
    );
  }
}

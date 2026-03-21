import { NextRequest, NextResponse } from "next/server";

const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;

if (!YOUTUBE_API_KEY) {
  throw new Error("Missing YOUTUBE_API_KEY environment variable");
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    const response = await fetch(
      `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&maxResults=1&q=${encodeURIComponent(query)}&key=${YOUTUBE_API_KEY}`,
    );

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.status}`);
    }

    const data = await response.json();
    const firstResult = data.items?.[0];

    if (!firstResult) {
      return NextResponse.json({ error: "No results found" }, { status: 404 });
    }

    return NextResponse.json({
      videoId: firstResult.id.videoId,
      title: firstResult.snippet.title,
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

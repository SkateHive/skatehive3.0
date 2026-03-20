import { NextRequest, NextResponse } from "next/server";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ error: "Missing query parameter" }, { status: 400 });
  }

  try {
    // Use yt-dlp to search YouTube and get first result
    const { stdout } = await execAsync(
      `yt-dlp --dump-json --playlist-end 1 "ytsearch:${query.replace(/"/g, '\\"')}" 2>/dev/null`
    );

    const data = JSON.parse(stdout.trim());

    return NextResponse.json({
      videoId: data.id,
      title: data.title,
      duration: data.duration,
    });
  } catch (error) {
    console.error("YouTube search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}

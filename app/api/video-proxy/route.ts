import { NextRequest, NextResponse } from "next/server";

// Allow up to 5 minutes for large transcoding responses on Vercel Pro+
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");
    const targetUrl = searchParams.get("url");
    const correlationId = searchParams.get("correlationId") ?? "n/a";

    if (!endpoint && !targetUrl) {
      return NextResponse.json(
        { error: "Missing endpoint or url parameter" },
        { status: 400 }
      );
    }

    const apiUrl =
      targetUrl ??
      `https://skatehive-transcoder.onrender.com${endpoint}`;

    console.log(`🔗 [${correlationId}] Proxying GET → ${apiUrl}`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ [${correlationId}] Proxy GET timeout: ${apiUrl}`);
      controller.abort();
    }, 10_000);

    const response = await fetch(apiUrl, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    const data = await parseResponseBody(response);

    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error("Proxy GET error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const endpoint = searchParams.get("endpoint");
    const targetUrl = searchParams.get("url");
    const correlationId = searchParams.get("correlationId") ?? "n/a";

    if (!endpoint && !targetUrl) {
      return NextResponse.json(
        { error: "Missing endpoint or url parameter" },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    // Prefer correlationId from the form body (set by videoProcessing.ts)
    const bodyCorrelationId =
      (formData.get("correlationId") as string | null) ?? correlationId;

    const apiUrl =
      targetUrl ??
      `https://skatehive-transcoder.onrender.com${endpoint}`;

    console.log(
      `🔗 [${bodyCorrelationId}] Proxying POST → ${apiUrl} (${
        Math.round((request.headers.get("content-length") ? Number(request.headers.get("content-length")) : 0) / 1024 / 1024)
      } MB)`
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(() => {
      console.log(`⏰ [${bodyCorrelationId}] Proxy POST timeout: ${apiUrl}`);
      controller.abort();
    }, 300_000); // 5 minutes — matches maxDuration

    const response = await fetch(apiUrl, {
      method: "POST",
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    console.log(
      `📬 [${bodyCorrelationId}] Proxy POST response: ${response.status} from ${apiUrl}`
    );

    const data = await parseResponseBody(response);

    return NextResponse.json(data, {
      status: response.status,
      headers: corsHeaders(),
    });
  } catch (error) {
    console.error("Proxy POST error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Proxy request failed" },
      { status: 500, headers: corsHeaders() }
    );
  }
}

export async function OPTIONS() {
  return NextResponse.json({}, { status: 200, headers: corsHeaders() });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse response body as JSON if Content-Type allows, otherwise wrap as text. */
async function parseResponseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  const text = await response.text();
  // Wrap plain-text or HTML error pages so callers always get a JSON object
  return { error: text || `HTTP ${response.status}` };
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

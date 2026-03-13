import { NextRequest, NextResponse } from "next/server";
import type { PoidhApiStatus, PoidhBounty } from "@/types/poidh";

const POIDH_API_URL = "https://poidh.xyz/api/trpc/bounties.fetchAll";
const CACHE_SECONDS = 60 * 15;
const ALLOWED_STATUSES: PoidhApiStatus[] = ["open", "past", "progress"];
const ALLOWED_CHAINS = new Set([8453, 42161]);

const STRONG_SKATE_KEYWORDS = [
  "skateboard",
  "skateboarding",
  "skate clip",
  "skate video",
  "skate spot",
  "skatepark",
  "skate park",
  "kickflip",
  "heelflip",
  "treflip",
  "360 flip",
  "ollie",
  "nollie",
  "pop shuv",
  "pop shove",
  "shuvit",
  "shove it",
  "boardslide",
  "lipslide",
  "tailslide",
  "noseslide",
  "crook",
  "smith",
  "feeble",
  "grind",
  "manual",
  "nose manual",
  "skater",
  "skatehive",
  "trey flip",
];

const TITLE_ONLY_SKATE_KEYWORDS = [
  "skate",
  "skating",
  "skate jam",
  "skate session",
  "bail",
  "ledge",
  "rail",
  "gap",
  "line",
  "vert",
  "street part",
];

const EXCLUDED_KEYWORDS = [
  "snowboard",
  "ski",
  "ai",
  "agent",
  "workspace",
  "stewardship",
  "garden",
  "public space",
  "clean & document",
  "word of the day",
  "soccer",
  "basketball",
  "surf",
];

function parseStatus(value: string | null): PoidhApiStatus {
  if (value && ALLOWED_STATUSES.includes(value as PoidhApiStatus)) {
    return value as PoidhApiStatus;
  }
  return "open";
}

function countMatches(haystack: string, keywords: string[]) {
  return keywords.reduce((count, keyword) => count + (haystack.includes(keyword) ? 1 : 0), 0);
}

function isSkateBounty(bounty: PoidhBounty) {
  const title = bounty.title.toLowerCase();
  const description = (bounty.description || "").toLowerCase();
  const haystack = `${title} ${description}`;

  if (EXCLUDED_KEYWORDS.some((keyword) => haystack.includes(keyword))) {
    return false;
  }

  const strongMatches = countMatches(haystack, STRONG_SKATE_KEYWORDS);
  const titleMatches = countMatches(title, TITLE_ONLY_SKATE_KEYWORDS);

  if (strongMatches >= 1) return true;
  if (titleMatches >= 1 && strongMatches >= 1) return true;

  return false;
}

async function fetchPoidhBounties(status: PoidhApiStatus, limit: number, offset: number) {
  const input = encodeURIComponent(
    JSON.stringify({
      json: { status, limit, offset },
    })
  );

  const response = await fetch(`${POIDH_API_URL}?input=${input}`, {
    next: { revalidate: CACHE_SECONDS },
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`POIDH API error: ${response.status}`);
  }

  const payload = await response.json();
  return payload?.result?.data?.json?.items ?? [];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const status = parseStatus(searchParams.get("status"));
    const limit = Math.min(Number(searchParams.get("limit") || "60"), 100);
    const offset = Math.max(Number(searchParams.get("offset") || "0"), 0);
    const filterSkate = searchParams.get("filterSkate") !== "false";

    const items = (await fetchPoidhBounties(status, limit, offset)) as PoidhBounty[];

    const filtered = items.filter((bounty) => {
      if (!ALLOWED_CHAINS.has(bounty.chainId)) return false;
      if (!filterSkate) return true;
      return isSkateBounty(bounty);
    });

    return NextResponse.json(
      {
        items: filtered,
        count: filtered.length,
        status,
        chains: Array.from(ALLOWED_CHAINS),
        filterSkate,
      },
      {
        headers: {
          "Cache-Control": `public, s-maxage=${CACHE_SECONDS}, stale-while-revalidate=${CACHE_SECONDS}`,
        },
      }
    );
  } catch (error: unknown) {
    return NextResponse.json(
      {
        error: "Failed to fetch POIDH bounties",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

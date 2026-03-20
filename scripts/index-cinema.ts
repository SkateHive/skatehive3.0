/**
 * Cinema Indexer — fetches Odysee RSS feeds, extracts brands/years,
 * writes public/data/cinema.json for static import.
 *
 * Run: npx ts-node scripts/index-cinema.ts
 */

import * as fs from "fs";
import * as path from "path";

const RSS_FEEDS = [
  "https://odysee.com/$/rss/@SkateVideoArchive:6",
  "https://odysee.com/$/rss/@SkateVideoLibrary:e",
  "https://odysee.com/$/rss/@SkatePlaza:7",
];

// Brand name normalization
const BRAND_OVERRIDES: Record<string, string> = {
  "cky": "CKY",
  "dc shoes": "DC Shoes",
  "dc": "DC Shoes",
  "cliche": "Cliché",
  "cliché": "Cliché",
  "fkd bearings": "FKD",
  "fkd": "FKD",
  "vox footwear": "Vox",
  "vox": "Vox",
  "88 footwear": "88 Footwear",
  "etnies footwear": "Etnies",
  "etnies": "Etnies",
  "transworld skateboarding": "TransWorld",
  "digital skateboarding": "Digital",
  "captured videomagazine": "Captured",
  "411 video magazine": "411VM",
  "el rio grind productions": "El Rio Grind",
  "darkstar skateboards": "Darkstar",
  "girl skateboards": "Girl",
  "real skateboards": "Real",
  "zero skateboards": "Zero",
  "enjoi skateboards": "Enjoi",
  "element skateboards": "Element",
  "habitat skateboards": "Habitat",
  "deathwish skateboards": "Deathwish",
  "globe shoes": "Globe",
  "globe": "Globe",
  "circa footwear": "Circa",
  "circa": "Circa",
  "control skateboards": "Control",
  "mystery skateboards": "Mystery",
  "mystery": "Mystery",
  "shorty's": "Shorty's",
  "adio footwear": "Adio",
  "adio": "Adio",
  "volcom clothing": "Volcom",
  "volcom": "Volcom",
  "the firm": "The Firm",
  "gold wheels": "Gold Wheels",
  "deca skateboards": "Deca",
  "deca": "Deca",
  "flip skateboards": "Flip",
  "flip": "Flip",
  "baker skateboards": "Baker",
  "baker": "Baker",
  "emerica shoes": "Emerica",
  "emerica": "Emerica",
  "spitfire wheels": "Spitfire",
  "spitfire": "Spitfire",
  "blind skateboards": "Blind",
  "blind": "Blind",
  "plan b skateboards": "Plan B",
  "plan b": "Plan B",
  "toy machine": "Toy Machine",
  "toy machine skateboards": "Toy Machine",
  "santa cruz": "Santa Cruz",
  "santa cruz skateboards": "Santa Cruz",
  "powell peralta": "Powell Peralta",
  "powell": "Powell Peralta",
  "anti hero": "Anti Hero",
  "antihero": "Anti Hero",
  "independent trucks": "Independent",
  "independent": "Independent",
  "thunder trucks": "Thunder",
  "thunder": "Thunder",
  "venture trucks": "Venture",
  "venture": "Venture",
  "krooked": "Krooked",
  "foundation": "Foundation",
  "foundation skateboards": "Foundation",
  "alien workshop": "Alien Workshop",
  "world industries": "World Industries",
  "birdhouse": "Birdhouse",
  "birdhouse skateboards": "Birdhouse",
  "chocolate skateboards": "Chocolate",
  "chocolate": "Chocolate",
  "dvs shoes": "DVS",
  "dvs": "DVS",
  "lakai": "Lakai",
  "lakai footwear": "Lakai",
  "tony hawk's project 8": "Tony Hawk",
  "round one": "Round One",
  "round two": "Round Two",
  "trilogy": "Trilogy",
  "és": "éS",
  "és | menikmati pt. 1": "éS",
  "és | menikmati pt. 2": "éS",
  "és | menikmati pt. 3": "éS",
  "és | menikmati pt. 4": "éS",
  "és | menikmati pt. 5": "éS",
  "és | menikmati pt. 6": "éS",
  "és | menikmati pt. 7": "éS",
  "és | menikmati pt. 8": "éS",
  "emerica stay gold b-side": "Emerica",
  "emerica stay gold b-sides": "Emerica",
  "wesc clothing & dc": "DC Shoes",
  "mason silva": "Mason Silva",
};

// Title-based brand detection for videos without colon/dash pattern
const TITLE_BRAND_MAP: [RegExp, string][] = [
  [/\bforecast\b.*paul rodriguez/i, "Paul Rodriguez"],
  [/\bwhat if\b/i, "What If"],
  [/\btrilogy\b/i, "Trilogy"],
  [/\bcariuma\b/i, "Cariuma"],
  [/\bneighbours\b/i, "Independent"],
];

interface CinemaVideo {
  slug: string;
  title: string;
  brand: string;
  year: number | null;
  embedUrl: string;
  thumbnail: string;
  description: string;
  channel: string;
  link: string;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function extractBrand(title: string): string {
  // Pattern 1: "Brand Name: Video Title (Year)"
  // Pattern 2: "Brand Name - Video Title (Year)"
  const match = title.match(/^(.+?)(?::\s+|\s+-\s+)/);
  if (match) {
    const raw = match[1].trim().toLowerCase();
    // Skip if the extracted brand is just a year (4-digit number)
    if (!/^\d{4}$/.test(raw)) {
      // Check overrides first (exact)
      if (BRAND_OVERRIDES[raw]) return BRAND_OVERRIDES[raw];
      // Check if any override key matches
      for (const [key, value] of Object.entries(BRAND_OVERRIDES)) {
        if (raw === key) return value;
      }
      // Clean up common suffixes
      let brand = match[1].trim();
      brand = brand.replace(/\s+(skateboards?|shoes|footwear|clothing|wheels|bearings|video magazine|productions?)\s*$/i, "");
      // Re-check overrides after cleanup
      const cleaned = brand.toLowerCase();
      if (BRAND_OVERRIDES[cleaned]) return BRAND_OVERRIDES[cleaned];
      return brand;
    }
  }
  // Check title-based brand patterns
  for (const [pattern, brand] of TITLE_BRAND_MAP) {
    if (pattern.test(title)) return brand;
  }
  return "Other";
}

function extractYear(title: string): number | null {
  const match = title.match(/\((\d{4})\)/);
  return match ? parseInt(match[1], 10) : null;
}

function extractEmbedUrl(link: string): string {
  try {
    const url = new URL(link);
    if (url.pathname.includes("/$/embed/")) return link;
    return `https://odysee.com/$/embed${url.pathname}`;
  } catch {
    return link;
  }
}

async function parseFeed(feedUrl: string): Promise<CinemaVideo[]> {
  console.log(`Fetching: ${feedUrl}`);
  const res = await fetch(feedUrl);
  if (!res.ok) {
    console.error(`Failed to fetch ${feedUrl}: ${res.status}`);
    return [];
  }

  const xml = await res.text();
  const videos: CinemaVideo[] = [];

  // Extract channel name
  const channelMatch = xml.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/);
  const channel = channelMatch?.[1]?.replace(" on Odysee", "").replace("@", "") || "Unknown";

  const items = xml.split("<item>").slice(1);
  console.log(`  Found ${items.length} items in ${channel}`);

  for (const item of items) {
    const titleMatch = item.match(/<title><!\[CDATA\[(.+?)\]\]><\/title>/);
    const linkMatch = item.match(/<link>(.+?)<\/link>/);
    const descMatch = item.match(/<description><!\[CDATA\[(.+?)\]\]><\/description>/s);
    const thumbMatch = item.match(/<itunes:image\s+href="(.+?)"/);

    const title = titleMatch?.[1] || "Untitled";
    const link = linkMatch?.[1] || "";
    if (!link) continue;

    let thumbnail = thumbMatch?.[1] || "";
    if (!thumbnail) {
      const imgMatch = item.match(/<img[^>]*src="([^"]+)"/);
      thumbnail = imgMatch?.[1] || "/ogimage.png";
    }

    const description = (descMatch?.[1] || "")
      .replace(/<[^>]*>/g, "")
      .slice(0, 300);

    const brand = extractBrand(title);
    const year = extractYear(title);
    const slug = slugify(title);

    videos.push({
      slug,
      title,
      brand,
      year,
      embedUrl: extractEmbedUrl(link),
      thumbnail,
      description,
      channel,
      link,
    });
  }

  return videos;
}

async function main() {
  console.log("🎬 Cinema Indexer — Starting...\n");

  const results = await Promise.all(RSS_FEEDS.map(parseFeed));
  const all = results.flat();

  // Deduplicate by title (normalized)
  const seen = new Set<string>();
  const deduped = all.filter((v) => {
    const key = v.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // Also deduplicate slugs
  const slugSeen = new Set<string>();
  for (const v of deduped) {
    if (slugSeen.has(v.slug)) {
      v.slug = `${v.slug}-${v.channel.toLowerCase()}`;
    }
    slugSeen.add(v.slug);
  }

  // Sort by year descending, then title
  deduped.sort((a, b) => {
    if (a.year && b.year) return b.year - a.year;
    if (a.year) return -1;
    if (b.year) return 1;
    return a.title.localeCompare(b.title);
  });

  // Extract unique brands (sorted by frequency)
  const brandCounts = new Map<string, number>();
  for (const v of deduped) {
    brandCounts.set(v.brand, (brandCounts.get(v.brand) || 0) + 1);
  }
  const brands = [...brandCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([brand]) => brand)
    .filter((b) => b !== "Other");

  // Log summary
  console.log(`\n📊 Summary:`);
  console.log(`  Total videos: ${deduped.length}`);
  console.log(`  Unique brands: ${brands.length}`);
  console.log(`\n🏷️ Brands (by frequency):`);
  for (const [brand, count] of [...brandCounts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`    ${brand}: ${count}`);
  }

  // Videos with no brand extracted
  const unbranded = deduped.filter((v) => v.brand === "Other");
  if (unbranded.length > 0) {
    console.log(`\n⚠️ Unbranded videos (${unbranded.length}):`);
    for (const v of unbranded) {
      console.log(`    "${v.title}"`);
    }
  }

  const output = {
    generatedAt: new Date().toISOString().split("T")[0],
    count: deduped.length,
    brands,
    videos: deduped,
  };

  const outPath = path.join(__dirname, "..", "public", "data", "cinema.json");
  const outDir = path.dirname(outPath);
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  fs.writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\n✅ Written to: ${outPath}`);
}

main().catch((err) => {
  console.error("❌ Indexer failed:", err);
  process.exit(1);
});

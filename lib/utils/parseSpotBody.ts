/**
 * Parses a Skatehive spot post body created by SpotSnapComposer.
 *
 * Format produced by the composer:
 *   Spot Name: <name>
 *   🌐 <lat>, <lng> (<address>)   |   🌐 <lat>, <lng>   |   🌐 <address>
 *
 *   <description...>
 *
 *   ![caption](image-url)
 *   ![caption](image-url)
 */

export interface ParsedSpot {
  name: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  rawLocation: string | null;
  description: string;
  images: { url: string; caption: string }[];
}

const IMAGE_RE = /!\[([^\]]*)\]\(([^)]+)\)/g;

function isValidCoord(lat: number, lng: number): boolean {
  return (
    !Number.isNaN(lat) &&
    !Number.isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

// Loose decimal-coordinate parser. Accepts e.g. "44.98898, -93.22583".
// Returns null if either side doesn't look like a decimal coord.
function parseDecimalCoords(s: string): { lat: number; lng: number } | null {
  const m = s.match(/^\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
  if (!m) return null;
  const lat = parseFloat(m[1]);
  const lng = parseFloat(m[2]);
  return isValidCoord(lat, lng) ? { lat, lng } : null;
}

/**
 * Pull lat/lng out of a Google Maps URL. Tries the patterns Google uses
 * (in priority order, most precise first):
 *   1. ...!3d<lat>!4d<lng>     — data param, exact place coords
 *   2. .../@<lat>,<lng>,<z>z   — viewport center
 *   3. ...?q=<lat>,<lng>       — explicit query
 *   4. ...?ll=<lat>,<lng>      — legacy lat/long param
 *   5. /place/<lat>,+<lng>     — coordinate path component
 */
function parseGoogleMapsUrl(s: string): { lat: number; lng: number } | null {
  const patterns = [
    /[!?&]3d(-?\d+(?:\.\d+)?)[!&]4d(-?\d+(?:\.\d+)?)/,
    /google\.[^/]+\/maps[^\s]*@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /google\.[^/]+\/maps[^\s]*[?&]q=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /google\.[^/]+\/maps[^\s]*[?&]ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/,
    /google\.[^/]+\/maps\/place\/(-?\d+(?:\.\d+)?),\+?(-?\d+(?:\.\d+)?)/,
  ];
  for (const re of patterns) {
    const m = s.match(re);
    if (m) {
      const lat = parseFloat(m[1]);
      const lng = parseFloat(m[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }
  }
  return null;
}

export function parseSpotBody(body: string | undefined | null): ParsedSpot {
  const out: ParsedSpot = {
    name: null,
    lat: null,
    lng: null,
    address: null,
    rawLocation: null,
    description: "",
    images: [],
  };

  if (!body) return out;

  // 1. Collect all images, then strip them from the body for the description.
  const images: { url: string; caption: string }[] = [];
  let descBody = body.replace(IMAGE_RE, (_match, caption: string, url: string) => {
    images.push({ url: url.trim(), caption: (caption || "").trim() });
    return "";
  });
  out.images = images;

  // 2. Walk lines, peel off "Spot Name:" and the "🌐 ..." location line.
  const lines = descBody.split(/\r?\n/);
  const remaining: string[] = [];
  for (const line of lines) {
    const nameMatch = line.match(/^\s*Spot Name\s*:\s*(.+?)\s*$/i);
    if (out.name === null && nameMatch) {
      out.name = nameMatch[1].trim();
      continue;
    }

    // 🌐 or "Location:" prefix
    const locMatch = line.match(/^\s*(?:🌐|Location\s*:)\s*(.+?)\s*$/);
    if (out.rawLocation === null && locMatch) {
      const value = locMatch[1].trim();
      out.rawLocation = value;

      // (a) "lat, lng (address)" — coords with parenthesized address
      const withAddr = value.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
      const coordsPart = withAddr ? withAddr[1].trim() : value;
      const decimal = parseDecimalCoords(coordsPart);
      if (decimal) {
        out.lat = decimal.lat;
        out.lng = decimal.lng;
        if (withAddr) out.address = withAddr[2].trim();
        continue;
      }

      // (b) A Google Maps URL pasted as the location — extract coords.
      // We deliberately don't surface the raw URL as the "address" since
      // it would render as a giant unreadable string on the spot page.
      const fromUrl = parseGoogleMapsUrl(value);
      if (fromUrl) {
        out.lat = fromUrl.lat;
        out.lng = fromUrl.lng;
        continue;
      }

      // (c) Freeform address — no coords we could extract.
      out.address = value;
      continue;
    }

    remaining.push(line);
  }

  out.description = remaining.join("\n").trim();
  return out;
}

export function isSpotPost(opts: {
  body?: string | null;
  json_metadata?: string | Record<string, unknown> | null;
}): boolean {
  const { body, json_metadata } = opts;
  // Tag check first (fast + reliable for composer-created spots)
  if (json_metadata) {
    try {
      const meta = typeof json_metadata === "string" ? JSON.parse(json_metadata) : json_metadata;
      const tags = (meta as { tags?: unknown })?.tags;
      if (Array.isArray(tags) && tags.includes("skatespot")) return true;
    } catch {
      // ignore malformed metadata, fall through to body check
    }
  }
  // Fallback: body starts with the composer's signature
  if (body && /^\s*Spot Name\s*:/i.test(body)) return true;
  return false;
}

/**
 * Guards server-side "fetch a URL the caller gave us" endpoints (link
 * previews, OG scraping) against SSRF: pointing the fetch at localhost,
 * a private/link-local range, or a cloud metadata endpoint.
 *
 * Checks the hostname string AND resolves it, so a public-looking hostname
 * that resolves to a private address (DNS rebinding) is still rejected.
 */
import dns from "node:dns/promises";
import net from "node:net";

const BLOCKED_HOSTNAMES = new Set(["localhost"]);
const BLOCKED_HOSTNAME_SUFFIXES = [".internal", ".local"];

// Inclusive [start, end] IPv4 ranges we refuse to fetch.
const IPV4_BLOCKED_RANGES: Array<[string, string]> = [
  ["10.0.0.0", "10.255.255.255"], // RFC1918
  ["100.64.0.0", "100.127.255.255"], // carrier-grade NAT (RFC6598)
  ["127.0.0.0", "127.255.255.255"], // loopback
  ["169.254.0.0", "169.254.255.255"], // link-local / cloud metadata (169.254.169.254)
  ["172.16.0.0", "172.31.255.255"], // RFC1918
  ["192.168.0.0", "192.168.255.255"], // RFC1918
];

function ipv4ToInt(ip: string): number {
  return (
    ip
      .split(".")
      .reduce((acc, octet) => (acc << 8) + Number(octet), 0) >>> 0
  );
}

function isBlockedIpv4(ip: string): boolean {
  const n = ipv4ToInt(ip);
  return IPV4_BLOCKED_RANGES.some(
    ([start, end]) => n >= ipv4ToInt(start) && n <= ipv4ToInt(end)
  );
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === "::1") return true;
  // fc00::/7 (unique local) — the block spans the fc and fd prefixes.
  if (lower.startsWith("fc") || lower.startsWith("fd")) return true;
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4 address too.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

/** True if `ip` is a private/loopback/link-local address we must not fetch. */
export function isBlockedIp(ip: string): boolean {
  if (net.isIPv4(ip)) return isBlockedIpv4(ip);
  if (net.isIPv6(ip)) return isBlockedIpv6(ip);
  return true; // not a recognizable IP — fail closed
}

export class PublicUrlGuardError extends Error {}

/**
 * Validates that `rawUrl` is an https URL whose host resolves to a public
 * address. Throws PublicUrlGuardError with a caller-safe message otherwise.
 * Returns the parsed URL on success.
 */
export async function assertPublicHttpsUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new PublicUrlGuardError("Invalid URL");
  }

  if (url.protocol !== "https:") {
    throw new PublicUrlGuardError("Only https URLs are allowed");
  }

  const hostname = url.hostname.toLowerCase();
  if (
    BLOCKED_HOSTNAMES.has(hostname) ||
    BLOCKED_HOSTNAME_SUFFIXES.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new PublicUrlGuardError("Host is not allowed");
  }

  // Literal IP in the URL — check directly, no DNS lookup needed.
  if (net.isIP(hostname)) {
    if (isBlockedIp(hostname)) {
      throw new PublicUrlGuardError("Host is not allowed");
    }
    return url;
  }

  let addresses: string[];
  try {
    addresses = (await dns.lookup(hostname, { all: true })).map((r) => r.address);
  } catch {
    throw new PublicUrlGuardError("Host could not be resolved");
  }

  if (addresses.length === 0 || addresses.some(isBlockedIp)) {
    throw new PublicUrlGuardError("Host is not allowed");
  }

  return url;
}

// Mirror of the portal's HomepageConfigDoc (src/lib/homepage-config.ts). Two
// repos, no shared package — same convention as the magazine's PortalPost. The
// /home route renders entirely from the PUBLISHED doc; money/status-shaped bits
// (rewards total, live bounty USD) are hydrated client-side, never stored.

export type PostRef = { author: string; permlink: string };

export type CtaTarget =
  | { kind: "post"; author: string; permlink: string }
  | { kind: "spot"; id: string }
  | { kind: "url"; url: string };

export type HeroSlide = {
  id: string;
  image: string;
  tag: string;
  title: string;
  subtitle: string;
  meta: string;
  cta: CtaTarget | null;
  postRef?: PostRef;
};

export type StripCard = { id: string; postRef: PostRef; image: string; title: string; category?: string };
export type JunkItem = { id: string; postRef: PostRef; thumb: string; title: string; blurb: string };
export type FeaturedVideo = { postRef: PostRef; cover: string; title: string; caption: string };

export type SpotPick = {
  id: string;
  name: string;
  image: string;
  author: string | null;
  permlink: string | null;
  coords: string | null;
};

export type BountyRef =
  | { source: "poidh"; id: string; chainId: number; name: string; issuer: string; image?: string }
  | { source: "hive"; author: string; permlink: string; title: string; sponsor: string };

export type FeaturedUser = { username: string };

export type HomepageConfigDoc = {
  heroSlides: HeroSlide[];
  strip: StripCard[];
  junkDrawer: JunkItem[];
  featuredVideo: FeaturedVideo | null;
  spot: SpotPick | null;
  bounties: BountyRef[];
  featuredUsers: FeaturedUser[];
  banner: { headline: string; subtext: string; ctaLabel: string };
  footer: { tagline: string };
};

/** Resolve a CTA/postRef to a skatehive.app route. */
export function ctaHref(cta: CtaTarget | null): string | null {
  if (!cta) return null;
  if (cta.kind === "post") return `/post/@${cta.author}/${cta.permlink}`;
  if (cta.kind === "spot") return `/map`;
  if (cta.kind === "url") return cta.url;
  return null;
}

export function postHref(ref: PostRef | undefined): string | null {
  return ref ? `/post/@${ref.author}/${ref.permlink}` : null;
}

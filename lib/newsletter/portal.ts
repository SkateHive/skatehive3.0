// Server-only helper for the SkateHive marketing portal (Paragraph publication).
// NEVER import this into a client component — it uses NEWSLETTER_API_SECRET.
//
// Status truth lives in the portal (subscribers + opt-out records). Callers pass
// an email and, optionally, a desired `subscribed` state. With no state it reads
// the current status; with a state it writes it. Either way the portal returns
// the resulting subscription status.

export type NewsletterPortalResult =
  | { ok: true; subscribed: boolean }
  | { ok: false; status: number; error: string };

export async function newsletterPortalRequest(
  email: string,
  subscribed?: boolean
): Promise<NewsletterPortalResult> {
  const base = process.env.NEWSLETTER_PORTAL_BASE_URL;
  const secret = process.env.NEWSLETTER_API_SECRET;
  if (!base || !secret) {
    return { ok: false, status: 503, error: "Newsletter service not configured" };
  }

  try {
    const res = await fetch(
      `${base.replace(/\/+$/, "")}/api/newsletter/preference`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-newsletter-secret": secret,
        },
        body: JSON.stringify(
          typeof subscribed === "boolean" ? { email, subscribed } : { email }
        ),
        cache: "no-store",
      }
    );

    const data = (await res.json().catch(() => null)) as {
      ok?: boolean;
      subscribed?: boolean;
      error?: string;
    } | null;

    if (!res.ok || !data?.ok) {
      return {
        ok: false,
        status: 502,
        error: data?.error || "Newsletter service error",
      };
    }

    return { ok: true, subscribed: Boolean(data.subscribed) };
  } catch {
    return { ok: false, status: 502, error: "Newsletter service error" };
  }
}

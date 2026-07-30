/**
 * App-owned notifications (see migration 0030).
 *
 * Hive's bridge.account_notifications covers blockchain events. This covers
 * everything SkateHive itself decides — starting with the cross-post curation
 * queue telling an author their submission was approved or passed on.
 *
 * Writing a notification must never break the action that triggered it: a
 * curator's approve should not 500 because the notify insert failed. Every
 * helper here swallows its errors and logs instead.
 */

/**
 * Who writes what:
 *   crosspost_queued    — this app, the moment the request is filed
 *   crosspost_rejected  — the portal (curator passed)
 *   crosspost_scheduled — the portal (approved for a future time)
 *   crosspost_published — the portal (it is live)
 *   crosspost_failed    — the portal (gave up publishing), or this app when an
 *                         immediate publish fails with the queue switched off
 *   crosspost_approved  — legacy: written by the app's own approve route
 *                         before the portal took over publishing. Kept so rows
 *                         already in the table still render.
 */
export type AppNotificationType =
  | "crosspost_queued"
  | "crosspost_rejected"
  | "crosspost_scheduled"
  | "crosspost_published"
  | "crosspost_failed"
  | "crosspost_approved";

export interface CreateAppNotificationInput {
  supabase: any;
  userId: string;
  type: AppNotificationType;
  title: string;
  body?: string | null;
  /** In-app path or absolute URL the notification links to. */
  link?: string | null;
  metadata?: Record<string, unknown>;
}

export const APP_NOTIFICATIONS_TABLE = "userbase_notifications";

export async function createAppNotification(
  input: CreateAppNotificationInput
): Promise<boolean> {
  if (!input.supabase || !input.userId) return false;
  try {
    const { error } = await input.supabase.from(APP_NOTIFICATIONS_TABLE).insert({
      user_id: input.userId,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      link: input.link ?? null,
      metadata: input.metadata ?? {},
    });
    if (error) {
      console.warn("[app-notifications] insert failed:", error.message);
      return false;
    }
    return true;
  } catch (err: any) {
    console.warn("[app-notifications] insert threw:", err?.message);
    return false;
  }
}

const PLATFORM_LABEL: Record<string, string> = {
  instagram: "Instagram",
  farcaster: "Farcaster",
};

function platformLabel(target: string): string {
  return PLATFORM_LABEL[target] ?? target;
}

/**
 * The request was filed for review.
 *
 * Without this, marking cross-post produces nothing the author can point at —
 * possibly for days. From their side that is indistinguishable from a bug, so
 * they click again and hit the duplicate guard: an action that never gave any
 * feedback starts returning an error. The toast covers the moment; this row is
 * what they find when they come back later wondering.
 *
 * Only the app can write it — at click time the portal doesn't know the
 * request exists yet.
 */
export async function notifyCrossPostQueued(args: {
  supabase: any;
  userId: string | null;
  queueId: string;
  target: string;
  hivePermlink: string | null;
  /** SkateHive URL of the snap, so the notification can link back to it. */
  permalinkUrl?: string | null;
}): Promise<void> {
  if (!args.userId) return;
  const platform = platformLabel(args.target);
  await createAppNotification({
    supabase: args.supabase,
    userId: args.userId,
    type: "crosspost_queued",
    title: `Your snap is with the curation team`,
    body: `They'll review it and post it${
      args.target === "instagram" ? " to @skatehive" : ""
    } on ${platform} if it fits the feed.`,
    link: args.permalinkUrl ?? null,
    metadata: {
      queue_id: args.queueId,
      target: args.target,
      hive_permlink: args.hivePermlink,
    },
  });
}

// The other outcomes — rejected, scheduled, published, failed — are written by
// the portal, which owns publishing. This app only renders them; see
// lib/notifications/localizeCrossPost.ts for the copy.

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

export type AppNotificationType =
  | "crosspost_approved"
  | "crosspost_rejected"
  | "crosspost_failed";

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
 * Cross-post approved and published.
 *
 * The copy is intentionally written from the author's point of view: they
 * asked for a cross-post days ago and need to be reminded WHICH one this is.
 */
export async function notifyCrossPostApproved(args: {
  supabase: any;
  userId: string | null;
  queueId: string;
  target: string;
  hivePermlink: string | null;
  /** Public URL of the published post, when the platform gives us one. */
  publishedUrl?: string | null;
}): Promise<void> {
  if (!args.userId) return;
  const platform = platformLabel(args.target);
  await createAppNotification({
    supabase: args.supabase,
    userId: args.userId,
    type: "crosspost_approved",
    title: `Your snap is live on ${platform} 🎉`,
    body: `The curation team approved your cross-post${
      args.target === "instagram" ? " to @skatehive" : ""
    }.`,
    link: args.publishedUrl ?? null,
    metadata: {
      queue_id: args.queueId,
      target: args.target,
      hive_permlink: args.hivePermlink,
      published_url: args.publishedUrl ?? null,
    },
  });
}

/**
 * Cross-post rejected.
 *
 * `note` is the curator's reason. It's optional in the queue, so the body
 * falls back to a neutral line rather than implying a reason was given.
 */
export async function notifyCrossPostRejected(args: {
  supabase: any;
  userId: string | null;
  queueId: string;
  target: string;
  hivePermlink: string | null;
  note?: string | null;
}): Promise<void> {
  if (!args.userId) return;
  const platform = platformLabel(args.target);
  await createAppNotification({
    supabase: args.supabase,
    userId: args.userId,
    type: "crosspost_rejected",
    title: `Your ${platform} cross-post wasn't picked up`,
    body: args.note
      ? `Curation team: "${args.note}"`
      : "The curation team passed on this one. Your snap is still live on SkateHive.",
    link: null,
    metadata: {
      queue_id: args.queueId,
      target: args.target,
      hive_permlink: args.hivePermlink,
      note: args.note ?? null,
    },
  });
}

/**
 * A curator approved it but the platform refused. The author didn't do
 * anything wrong, but a revoked Farcaster signer IS on them to fix, so we say
 * what happened instead of staying silent.
 */
export async function notifyCrossPostFailed(args: {
  supabase: any;
  userId: string | null;
  queueId: string;
  target: string;
  hivePermlink: string | null;
  error: string;
}): Promise<void> {
  if (!args.userId) return;
  const platform = platformLabel(args.target);
  await createAppNotification({
    supabase: args.supabase,
    userId: args.userId,
    type: "crosspost_failed",
    title: `Your ${platform} cross-post couldn't be published`,
    body: args.error,
    link: null,
    metadata: {
      queue_id: args.queueId,
      target: args.target,
      hive_permlink: args.hivePermlink,
      error: args.error,
    },
  });
}

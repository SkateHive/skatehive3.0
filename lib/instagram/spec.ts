export const INSTAGRAM_PUBLICATION_TRIGGER = "client_after_hive_publish";

export const INSTAGRAM_PER_USER_24H_LIMIT = 7;
export const INSTAGRAM_ACCOUNT_24H_LIMIT = 25;
export const INSTAGRAM_MIN_HIVE_POWER_TO_CROSSPOST = 100;
export const INSTAGRAM_RETRYABLE_QUEUE_WINDOW_MS = 10 * 60 * 1000;

export const INSTAGRAM_IMAGE_REQUIREMENTS = {
  acceptedFormats: ["jpeg", "png"],
  recommendedAspectRatios: ["1.91:1", "4:5"],
  notes: [
    "Media must be reachable via a public http(s) URL so Meta can fetch it.",
    "Meta may auto-convert PNG uploads before publishing.",
  ],
} as const;

export const INSTAGRAM_REEL_REQUIREMENTS = {
  acceptedFormats: ["mp4 (H.264/AAC)"],
  recommendedAspectRatios: ["9:16"],
  recommendedDurationSeconds: { min: 3, max: 90 },
  recommendedMaxFileSizeMb: 100,
  notes: [
    "Videos outside Meta's supported duration or encoding rules can fail after upload.",
    "SkateHive sends the snap thumbnail as the Reel cover when available.",
  ],
} as const;

export type InstagramCrossPostPayload = {
  hive_author: string;
  hive_permlink: string;
  title?: string;
  body: string;
  tags?: string[];
  image_url?: string;
  video_url?: string;
  permalink_url: string;
  preview?: boolean;
  hive_signature?: string;
  hive_public_key?: string;
  signed_at?: string;
};

export function getInstagramCrossPostContract() {
  return {
    publication_trigger: INSTAGRAM_PUBLICATION_TRIGGER,
    publisher_account: "@skatehive",
    opt_in: {
      surface: "Snap composer destination menu",
      default_state: "enabled for eligible main-feed snaps with media",
      eligibility: {
        minimum_hive_power: INSTAGRAM_MIN_HIVE_POWER_TO_CROSSPOST,
        feed_scope: "main feed only",
        media_required: true,
      },
      admin_override: "POST /api/instagram/force-post",
    },
    limits: {
      per_user_24h: INSTAGRAM_PER_USER_24H_LIMIT,
      shared_account_24h: INSTAGRAM_ACCOUNT_24H_LIMIT,
      queue_retry_window_ms: INSTAGRAM_RETRYABLE_QUEUE_WINDOW_MS,
    },
    media_requirements: {
      image: INSTAGRAM_IMAGE_REQUIREMENTS,
      reel: INSTAGRAM_REEL_REQUIREMENTS,
    },
    ownership: {
      ui: "SnapComposer decides opt-in and assembles the payload after Hive publish.",
      api: "Instagram routes authenticate, rate-limit, render captions, dedupe, persist audit rows, and call Meta Graph.",
    },
  } as const;
}

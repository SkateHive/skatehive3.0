import type { Operation } from "@hiveio/dhive";
import { validateHiveUsernameFormat } from "@/lib/utils/hiveAccountUtils";

export interface ScheduledPostRow {
  hive_author: string;
  parent_author: string;
  parent_permlink: string;
  permlink: string;
  title: string;
  body: string;
  json_metadata: Record<string, any>;
  beneficiaries: Array<{ account: string; weight: number }>;
}

export function validateScheduledAt(value: unknown): { valid: boolean; error?: string } {
  if (!value || typeof value !== "string") {
    return { valid: false, error: "scheduled_at is required" };
  }
  const d = new Date(value);
  if (isNaN(d.getTime())) {
    return { valid: false, error: "scheduled_at is not a valid ISO date" };
  }
  if (d.getTime() <= Date.now()) {
    return { valid: false, error: "scheduled_at must be in the future" };
  }
  return { valid: true };
}

export function canCancelPost(
  post: { user_id: string; status: string },
  requestingUserId: string
): { allowed: boolean; code?: "NOT_OWNER" | "NOT_PENDING" } {
  if (post.user_id !== requestingUserId) return { allowed: false, code: "NOT_OWNER" };
  if (post.status !== "pending") return { allowed: false, code: "NOT_PENDING" };
  return { allowed: true };
}

export function buildScheduledPostOps(post: ScheduledPostRow): Operation[] {
  const ops: Operation[] = [
    [
      "comment",
      {
        parent_author: post.parent_author,
        parent_permlink: post.parent_permlink,
        author: post.hive_author,
        permlink: post.permlink,
        title: post.title,
        body: post.body,
        json_metadata: JSON.stringify(post.json_metadata),
      },
    ],
  ];

  const validBeneficiaries = post.beneficiaries.filter((b) => {
    if (!b?.account || typeof b.account !== "string") return false;
    if (!b?.weight || Number(b.weight) <= 0) return false;
    return validateHiveUsernameFormat(b.account).isValid;
  });

  if (validBeneficiaries.length > 0) {
    const totalWeight = validBeneficiaries.reduce((sum, b) => sum + Number(b.weight), 0);
    if (totalWeight <= 10000) {
      ops.push([
        "comment_options",
        {
          author: post.hive_author,
          permlink: post.permlink,
          max_accepted_payout: "1000000.000 HBD",
          percent_hbd: 10000,
          allow_votes: true,
          allow_curation_rewards: true,
          extensions: [
            [
              0,
              {
                beneficiaries: validBeneficiaries.map((b) => ({
                  account: b.account,
                  weight: b.weight,
                })),
              },
            ],
          ],
        },
      ]);
    }
  }

  return ops;
}

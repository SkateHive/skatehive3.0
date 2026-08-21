"use client";

import { useQuery } from "@tanstack/react-query";
import { Discussion } from "@hiveio/dhive";
import { isAddress } from "viem";
import useSoftPostOverlay from "@/hooks/useSoftPostOverlay";
import { extractSafeUser } from "@/lib/userbase/safeUserMetadata";
import { migrateLegacyMetadata } from "@/lib/utils/metadataMigration";
import { fetchAccount } from "@/lib/hive/fetchAccount";
import { HIVE_CONFIG } from "@/config/app.config";

export interface TipRecipient {
  /** What to show in the UI. */
  displayName: string;
  /** Hive account that can receive a HIVE/HBD transfer, when there is one. */
  hiveAccount: string | null;
  /** Verified EVM address, when the author has published one. */
  evmAddress: `0x${string}` | null;
  /** True while the EVM lookup is still in flight. */
  isLoading: boolean;
}

const SHARED_POSTING_ACCOUNTS = new Set([
  "skateuser",
  HIVE_CONFIG.APP_ACCOUNT,
]);

/** Reads the EVM address a Hive user published in their profile metadata. */
function evmFromHiveMetadata(raw: Record<string, any>): string | null {
  return migrateLegacyMetadata(raw).extensions?.wallets?.primary_wallet || null;
}

/**
 * Works out who actually gets the money for a given post.
 *
 * The author on the post is not always the author of the post: lite accounts
 * broadcast through a shared Hive account, so `discussion.author` can be
 * "skateuser" while the real writer is a userbase profile behind the overlay.
 * Tipping the raw author in that case would pay the shared account, so a soft
 * post resolves to the real user and exposes no Hive rail — that person has no
 * Hive account of their own to receive a transfer.
 */
export default function useTipRecipient(
  discussion: Discussion | undefined,
  { enabled = true }: { enabled?: boolean } = {}
): TipRecipient {
  const author = discussion?.author;
  const permlink = discussion?.permlink;
  const safeUser = extractSafeUser(discussion?.json_metadata);
  const overlay = useSoftPostOverlay(author, permlink, safeUser);

  const isSoftPost =
    !!author && SHARED_POSTING_ACCOUNTS.has(author.toLowerCase()) && !!overlay;

  const userbaseHandle = isSoftPost ? overlay?.user.handle ?? null : null;
  const hiveAccount = isSoftPost ? null : author ?? null;

  const lookupKey: Record<string, string> | null = userbaseHandle
    ? { handle: userbaseHandle }
    : hiveAccount
      ? { hive_handle: hiveAccount }
      : null;

  const { data: evmAddressData, isLoading } = useQuery({
    queryKey: ["tip-recipient-evm", hiveAccount, userbaseHandle],
    enabled: enabled && (!!hiveAccount || !!userbaseHandle),
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      // A Hive author may have published their wallet directly on-chain,
      // in either metadata slot depending on when it was set — check both
      // before falling back to a userbase-linked identity.
      if (hiveAccount) {
        try {
          const { jsonMetadata, postingMetadata } = await fetchAccount(hiveAccount);
          const onChainWallet =
            evmFromHiveMetadata(postingMetadata) || evmFromHiveMetadata(jsonMetadata);
          if (onChainWallet) return onChainWallet;
        } catch {
          // Hive API hiccup — fall through to the userbase lookup below.
        }
      }

      if (!lookupKey) return null;
      const params = new URLSearchParams(lookupKey);
      const response = await fetch(`/api/userbase/profile?${params}`);
      if (!response.ok) return null;
      const data = await response.json();
      const evm = (data?.identities || []).find(
        (identity: any) => identity.type === "evm" && identity.address
      );
      return (evm?.address as string) || null;
    },
  });

  const evmAddress =
    evmAddressData && isAddress(evmAddressData) ? (evmAddressData as `0x${string}`) : null;

  const displayName =
    overlay?.user.display_name ||
    overlay?.user.handle ||
    author ||
    "";

  return {
    displayName,
    hiveAccount,
    evmAddress,
    isLoading,
  };
}

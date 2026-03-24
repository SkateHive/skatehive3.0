import HiveClient from "@/lib/hive/hiveclient";
import { useEffect, useState } from "react";
import { ExtendedAccount } from "@hiveio/dhive";
import { localCacheGet, localCacheSet } from "@/lib/utils/localCache";

interface HiveAccountMetadataProps {
  [key: string]: any;
}
export interface HiveAccount extends ExtendedAccount {
  metadata?: HiveAccountMetadataProps;
  pending_claimed_accounts?: string | number;
}

const CACHE_KEY = (u: string) => `hive_account_${u.toLowerCase()}`;
// Show cached for up to 24h, but always re-fetch in the background
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

export default function useHiveAccount(username: string) {
  const [hiveAccount, setHiveAccount] = useState<HiveAccount | null>(() =>
    username ? localCacheGet<HiveAccount>(CACHE_KEY(username), MAX_AGE_MS) : null
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!username) {
      setHiveAccount(null);
      setIsLoading(false);
      return;
    }

    // Load from localStorage immediately (stale data shown right away)
    const cached = localCacheGet<HiveAccount>(CACHE_KEY(username), MAX_AGE_MS);
    if (cached) setHiveAccount(cached);

    // Always fetch fresh in the background
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    (async () => {
      try {
        const userData = await HiveClient.database.getAccounts([username]);
        if (cancelled) return;

        if (!userData || userData.length === 0) {
          setHiveAccount(null);
          setError("Account not found");
          return;
        }

        const userAccount: HiveAccount = { ...userData[0] };
        if (userAccount.posting_json_metadata) {
          userAccount.metadata = JSON.parse(userAccount.posting_json_metadata);
        } else if (userAccount.json_metadata) {
          userAccount.metadata = JSON.parse(userAccount.json_metadata);
        } else {
          userAccount.metadata = {};
        }

        setHiveAccount(userAccount);
        localCacheSet(CACHE_KEY(username), userAccount);
      } catch (err) {
        if (!cancelled) {
          console.error("❌ useHiveAccount: Error loading account:", err);
          setError("Loading account error!");
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [username]);

  return { hiveAccount, isLoading, error };
}

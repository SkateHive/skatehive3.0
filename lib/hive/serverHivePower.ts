import HiveClient from "@/lib/hive/hiveclient";

/**
 * Server-side Hive Power lookup. Mirrors the math in hooks/useHivePower so the
 * trusted-user gate on cross-post endpoints uses the same definition the UI
 * displays elsewhere (e.g. SnapComposer's 100-HP video-length bypass).
 *
 * Returns null on lookup failure so callers can decide whether to fail-open or
 * fail-closed. For trust-gated features, fail-closed: treat null as "below
 * threshold" so a degraded Hive RPC can't be used to bypass the check.
 */
export async function getHivePowerForAccount(username: string): Promise<number | null> {
  const handle = username?.trim().toLowerCase();
  if (!handle) return null;

  try {
    const accounts = await HiveClient.database.getAccounts([handle]);
    const acc = accounts?.[0];
    if (!acc) return null;

    const globalProps = await HiveClient.call(
      "condenser_api",
      "get_dynamic_global_properties",
      []
    );
    const totalVestingFund = parseFloat(
      String(globalProps.total_vesting_fund_hive).split(" ")[0]
    );
    const totalVestingShares = parseFloat(
      String(globalProps.total_vesting_shares).split(" ")[0]
    );
    const vestingShares = parseFloat(String(acc.vesting_shares).split(" ")[0]);
    const receivedVestingShares = parseFloat(
      String(acc.received_vesting_shares).split(" ")[0]
    );
    const delegatedVestingShares = parseFloat(
      String(acc.delegated_vesting_shares).split(" ")[0]
    );
    const userVests =
      vestingShares + receivedVestingShares - delegatedVestingShares;
    if (totalVestingShares <= 0) return null;
    return (totalVestingFund * userVests) / totalVestingShares;
  } catch {
    return null;
  }
}

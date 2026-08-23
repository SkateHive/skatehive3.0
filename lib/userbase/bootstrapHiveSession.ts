/**
 * Turn a connected Hive identity into an app-account (userbase) session.
 *
 * The passive UserbaseWalletBootstrapper effect is supposed to do this, but it
 * is skipped whenever any session already exists, fails silently, and throttles
 * 60s — so Hive-login paths must trigger the bridge explicitly and surface the
 * result. Callers should `await refresh()` from UserbaseAuthContext afterwards
 * so the new session is loaded into the UI.
 *
 * Throws on failure with a human-readable message.
 */
export async function bootstrapHiveSession(username: string): Promise<void> {
  const handle = username.trim().toLowerCase();
  const res = await fetch("/api/userbase/auth/bootstrap", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "hive",
      identifier: handle,
      handle,
      display_name: handle,
      avatar_url: `https://images.hive.blog/u/${handle}/avatar`,
    }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.error || "Failed to create your app account session.");
  }
}

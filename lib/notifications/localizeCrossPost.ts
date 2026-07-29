/**
 * Rebuilds a cross-post notification's copy in the reader's language.
 *
 * The stored title/body are written server-side, in English, at the moment the
 * curator decides — so they can't follow the reader's locale. The row also
 * stores `type` and `metadata`, which is everything needed to render the copy
 * on the client instead. The stored text stays as a fallback, so an unknown
 * type or a locale missing the key still renders something real.
 *
 * Pure and free of React/Chakra imports so it can be unit-tested directly.
 */
import type { AppNotification } from "@/contexts/NotificationContext";

export type Translate = (key: string) => string;

/** Single source of truth for the namespace: it's used both to build the
 *  translator and to recognize an unresolved key below. Two copies of this
 *  string would let a rename silently disable the fallback, and the UI would
 *  start rendering raw key paths at users. */
export const CROSSPOST_NOTIF_NS = "notificationsPage.crosspost";

/**
 * `t` has no interpolation, hence the per-platform keys: there are exactly two
 * platforms, so a suffix beats a placeholder.
 */
export function localizeCrossPostNotification(
  notification: AppNotification,
  t: Translate
): { title: string; body: string | null } {
  const platform =
    (notification.metadata?.target as string) === "farcaster" ? "Farcaster" : "Instagram";

  // LocaleContext already falls back to English when a key is missing from the
  // active locale, so in practice this only fires if the key is missing from
  // en.ts TOO — someone deleting or renaming it. Kept anyway: without it that
  // mistake ships the raw key path ("notificationsPage.crosspost.approved…")
  // into the user's inbox, whereas the stored English copy is at worst stale.
  // Last-resort net, not the normal path.
  const tr = (key: string): string | null => {
    const value = t(key);
    return value === `${CROSSPOST_NOTIF_NS}.${key}` ? null : value;
  };

  const note = (notification.metadata?.note as string | undefined) || null;
  const noteLabel = tr("rejectedNoteLabel");

  switch (notification.type) {
    case "crosspost_approved":
      return {
        title: tr(`approvedTitle${platform}`) ?? notification.title,
        body: tr(`approvedBody${platform}`) ?? notification.body,
      };
    case "crosspost_rejected":
      return {
        title: tr(`rejectedTitle${platform}`) ?? notification.title,
        // The curator's reason is free text in whatever language they wrote —
        // only the label around it can be localized.
        body: note
          ? `${noteLabel ?? "Curation team:"} "${note}"`
          : tr("rejectedBodyNoNote") ?? notification.body,
      };
    case "crosspost_failed":
      return {
        title: tr(`failedTitle${platform}`) ?? notification.title,
        // The body is the platform's own error string — untranslatable, and
        // more useful raw than paraphrased.
        body: notification.body,
      };
    default:
      return { title: notification.title, body: notification.body };
  }
}

/**
 * Applies the thumbnail override/fallback rules shared by the spotmap read
 * routes (list + single). Sync jobs never write thumbnail_override or
 * thumbnail_small, so this is the only place the effective values are
 * computed — from here on, `thumbnail` in an API response means "the
 * widget-safe, admin-overridable image", not the raw source URL.
 */
export function effectiveThumbnail<
  T extends { thumbnail?: string | null; thumbnail_override?: string | null }
>(row: T): string | null {
  return row.thumbnail_override ?? row.thumbnail ?? null;
}

export function withEffectiveThumbnails<
  T extends {
    thumbnail?: string | null;
    thumbnail_override?: string | null;
    thumbnail_small?: string | null;
  }
>(row: T): T & { thumbnail: string | null; thumbnail_small: string | null } {
  const thumbnail = effectiveThumbnail(row);
  return {
    ...row,
    thumbnail,
    thumbnail_small: row.thumbnail_small ?? thumbnail,
  };
}

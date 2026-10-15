"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Plain JSON-RPC rather than the dhive client: this hook runs on the skaters
 * grid, and importing HiveClient here pulls dhive into that page's first load
 * for one read that a fetch does just as well.
 */
const HIVE_RPC = "https://api.hive.blog";

/** `get_following` caps a page at 1000 rows. */
const PAGE_SIZE = 1000;
/** 10k follows is far past any real account; the guard just stops a runaway loop. */
const MAX_PAGES = 10;

interface FollowRow {
  following?: string;
}

/**
 * Everyone the viewer already follows, fetched ONCE as a set.
 *
 * The per-card alternative (`checkFollow`, i.e. one
 * `get_relationship_between_accounts` call per pair) costs one request per
 * skater on screen — 30 on mount and 30 more per "load more". This costs one
 * request per 1000 follows regardless of how many cards render, so the grid's
 * page size stops being a factor in what the follow buttons cost.
 *
 * A failure here is deliberately not fatal: the buttons just start from
 * "Follow", and the broadcast path re-checks the real relationship anyway.
 */
export default function useFollowingSet(viewer: string | null) {
  const [following, setFollowing] = useState<Set<string> | null>(null);
  // Follows made while the pages above are still in flight. Walking a large
  // account takes seconds, and a follow performed in that window used to be
  // dropped on the floor: the button stayed on "Follow" even though the
  // broadcast went through, and the arriving snapshot pre-dated it.
  const pending = useRef(new Map<string, boolean>());

  useEffect(() => {
    if (!viewer) {
      setFollowing(null);
      pending.current.clear();
      return;
    }

    let cancelled = false;

    (async () => {
      const names = new Set<string>();
      let start = "";

      try {
        for (let page = 0; page < MAX_PAGES; page++) {
          const response = await fetch(HIVE_RPC, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              method: "condenser_api.get_following",
              params: [viewer, start, "blog", PAGE_SIZE],
              id: 1,
            }),
          });
          if (!response.ok) throw new Error(`Hive RPC responded ${response.status}`);
          const payload = await response.json();
          const rows: FollowRow[] = payload?.result ?? [];
          if (!Array.isArray(rows) || rows.length === 0) break;

          // Every page after the first echoes `start` back as its first row.
          for (const row of start ? rows.slice(1) : rows) {
            if (row?.following) names.add(row.following);
          }

          if (rows.length < PAGE_SIZE) break;
          const last = rows[rows.length - 1]?.following;
          if (!last || last === start) break;
          start = last;
        }
      } catch (error) {
        console.error("[skaters] could not load the viewer's following list:", error);
      }

      if (cancelled) return;
      // Anything the viewer did while this was loading outranks the snapshot.
      for (const [username, isFollowing] of pending.current) {
        if (isFollowing) names.add(username);
        else names.delete(username);
      }
      pending.current.clear();
      setFollowing(names);
    })();

    return () => {
      cancelled = true;
    };
  }, [viewer]);

  /** Keeps the set in step with a follow/unfollow the user just made. */
  const markFollowing = useCallback((username: string, isFollowing: boolean) => {
    pending.current.set(username, isFollowing);
    setFollowing((prev) => {
      // Seed a set even before the first page lands, so the button the viewer
      // just pressed flips immediately. `pending` still holds the change so the
      // arriving snapshot — which pre-dates it — cannot undo it.
      if (prev && prev.has(username) === isFollowing) return prev;
      const next = new Set(prev ?? []);
      if (isFollowing) next.add(username);
      else next.delete(username);
      return next;
    });
  }, []);

  return { following, markFollowing };
}

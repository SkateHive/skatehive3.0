import { cache } from "react";
import HiveClient from "@/lib/hive/hiveclient";
import type { Discussion } from "@hiveio/dhive";

/**
 * Shared, request-deduplicated Hive content fetchers for Server Components.
 *
 * Why this exists
 * ---------------
 * Every content route (`/post`, `/spot`, `/blog/tag`, `/user/.../snap`) used
 * to roll its own `get_content` helper and call it TWICE per request — once in
 * `generateMetadata()` and again in the page body. On Fluid compute the second
 * round-trip is pure network wall-time, billed as provisioned-memory-seconds.
 *
 * Wrapping the fetch in React's `cache()` memoizes it for the lifetime of a
 * single server render, so metadata + body share ONE RPC. Same inputs →
 * one network call. This roughly halves the Hive RPC time on every cold render.
 *
 * All fetchers return `null`/`[]` on failure (invalid input, node error, not
 * found) so callers can branch without try/catch and pages degrade gracefully.
 */

/** Strip a leading "@" from a Hive author handle. */
function cleanAuthor(author: string): string {
  return author.startsWith("@") ? author.slice(1) : author;
}

/** Real Hive permlinks are kebab-case slugs of 2+ chars, never pure numbers. */
function isPlausiblePermlink(permlink: unknown): permlink is string {
  return (
    typeof permlink === "string" &&
    permlink.length >= 2 &&
    !/^\d+$/.test(permlink)
  );
}

/**
 * Fetch a single Hive post/comment by author + permlink.
 * De-duplicated per request via `cache()`.
 */
export const getPostContent = cache(
  async (author: string, permlink: string): Promise<Discussion | null> => {
    if (!isPlausiblePermlink(permlink)) return null;
    try {
      const post = (await HiveClient.database.call("get_content", [
        cleanAuthor(author),
        permlink,
      ])) as Discussion;
      if (!post || !post.author) return null;
      return post;
    } catch (error) {
      console.error(
        `[getPostContent] @${cleanAuthor(author)}/${permlink}:`,
        error
      );
      return null;
    }
  }
);

export type RankedPost = {
  author?: string;
  permlink?: string;
  title?: string;
  created?: string;
};

/**
 * Fetch the most recent posts under a tag via the Hive bridge API.
 * De-duplicated per request via `cache()`.
 */
export const getRankedPostsByTag = cache(
  async (tag: string, limit = 20): Promise<RankedPost[]> => {
    try {
      const posts: RankedPost[] = await HiveClient.call(
        "bridge",
        "get_ranked_posts",
        { sort: "created", tag, limit, observer: "" }
      );
      return posts || [];
    } catch (error) {
      console.error(`[getRankedPostsByTag] #${tag}:`, error);
      return [];
    }
  }
);

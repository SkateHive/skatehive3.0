import styles from "./card.module.css";
import type { Metadata } from "next";
import VoteActions from "./VoteActions";
import { extractPostThumbnail } from "@/lib/utils/postThumbnail";
import { notFound } from "next/navigation";
import { getPostContent } from "@/lib/hive/server-content";
import { APP_CONFIG } from "@/config/app.config";

export const revalidate = 3600;
export const dynamicParams = true;

type Props = { params: Promise<{ author: string; permlink: string }> };

function cleanExcerpt(body: string, max = 220) {
  const text = body
    .replace(/<[^>]*>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[#*_`>]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  return text.length > max ? `${text.slice(0, max - 1).trim()}…` : text;
}

async function load(params: Props["params"]) {
  const { author, permlink } = await params;
  const post = await getPostContent(author.replace(/^@/, ""), permlink);
  if (!post) notFound();
  return post;
}

function cover(post: Parameters<typeof extractPostThumbnail>[0]) {
  const url = extractPostThumbnail(post);
  // Local JPEG of the verified IPFS image, available to crawlers without the gateway.
  const localPhoto = "bafkreifx67chnes2pzo7tb24t5kw3lpdpiuumwiylgf7j6jiz6qctumjiu";
  if (url?.split("?")[0].endsWith("/" + localPhoto)) {
    return APP_CONFIG.ORIGIN + "/embed-brand/" + localPhoto + ".jpg";
  }
  return url?.startsWith("https://") ? url : APP_CONFIG.ORIGIN + "/ogimage.png";
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await load(params);
  const base = APP_CONFIG.ORIGIN;
  const page = `${base}/embed/${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
  const image = cover(post);
  const description = cleanExcerpt(post.body || "Skateboarding stories from Skatehive.") || "A post from the Skatehive community.";

  return {
    title: post.title || `Post by @${post.author}`,
    description,
    alternates: { canonical: page },
    openGraph: { title: post.title || `Post by @${post.author}`, description, url: page, images: [image], siteName: "Skatehive", type: "article" },
    twitter: {
      card: "player",
      site: "@skatehive",
      title: post.title || `Post by @${post.author}`,
      description,
      images: [image],
      players: [{ playerUrl: page + "/player", streamUrl: "", width: 640, height: 520 }],
    },
  };
}

export default async function PostEmbedPage({ params }: Props) {
  const post = await load(params);
  const fullUrl = `${APP_CONFIG.ORIGIN}/post/${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
  const excerpt = cleanExcerpt(post.body || "") || "Open the post to read the full story.";

  return (
    <main className={styles.canvas}>
      <article className={styles.card}>
        <header>
          <div className={styles.brand}><img src="/embed-brand/logo.svg" alt="" />Skatehive</div>
          <span className={styles.author}>@{post.author}</span>
        </header>
        <a href={fullUrl} target="_blank" rel="noopener noreferrer" aria-label={post.title || post.permlink}>
          <img className={styles.cover} src={cover(post)} alt="" />
        </a>
        <section>
          <h1>{post.title || post.permlink}</h1>
          {excerpt && <p>{excerpt}</p>}
        </section>
        <VoteActions author={post.author} permlink={post.permlink} fullUrl={fullUrl} comments={post.children} allowVotes={post.allow_votes} />
      </article>
    </main>
  );
}

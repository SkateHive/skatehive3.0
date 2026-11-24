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
    openGraph: { title: post.title || `Post by @${post.author}`, description, url: page, images: [image], siteName: "Skatehive", type: "article" },
    twitter: {
      card: "player",
      site: "@skatehive",
      title: post.title || `Post by @${post.author}`,
      description,
      images: [image],
      players: [{ playerUrl: page, streamUrl: "", width: 640, height: 480 }],
    },
  };
}

export default async function PostEmbedPage({ params }: Props) {
  const post = await load(params);
  const fullUrl = `${APP_CONFIG.ORIGIN}/post/${encodeURIComponent(post.author)}/${encodeURIComponent(post.permlink)}`;
  const excerpt = cleanExcerpt(post.body || "") || "Open the post to read the full story.";

  return (
    <main style={{ minHeight: "100dvh", background: "#11131a", color: "#f5f6fa", padding: 20, fontFamily: "system-ui, sans-serif", boxSizing: "border-box" }}>
      <article style={{ maxWidth: 680, margin: "0 auto", border: "1px solid #343946", borderRadius: 16, overflow: "hidden", background: "#1b1e27" }}>
        <header style={{ padding: "16px 18px 10px", color: "#aeb6c8", fontSize: 14 }}>@{post.author}</header>
        <img src={cover(post)} alt="" style={{ width: "100%", height: "clamp(90px, 32vh, 160px)", objectFit: "cover" }} />
        <section style={{ padding: "4px 18px 18px" }}>
          <h1 style={{ fontSize: 22, lineHeight: 1.25, margin: "0 0 10px", color: "#fff" }}>{post.title || `Post by @${post.author}`}</h1>
          <p style={{ color: "#c2c8d5", lineHeight: 1.55, margin: 0 }}>{excerpt}</p>
        </section>
        <VoteActions author={post.author} permlink={post.permlink} fullUrl={fullUrl} comments={post.children} allowVotes={post.allow_votes} />
      </article>
    </main>
  );
}

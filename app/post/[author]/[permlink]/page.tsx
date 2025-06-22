import PostPage from "@/components/blog/PostPage";
import HiveClient from "@/lib/hive/hiveclient";
import { cleanUsername } from "@/lib/utils/cleanUsername";
import { Metadata } from "next";

// Constants
const DOMAIN_URL = "https://my.skatehive.app";
const FALLBACK_IMAGE = "https://my.skatehive.app/ogimage.png";

// Function to safely parse JSON metadata that might be double-encoded
function parseJsonMetadata(
  jsonMetadata: any
): { image?: string[]; thumbnail?: string[] } | null {
  if (!jsonMetadata) return null;

  try {
    let parsed = jsonMetadata;

    // If it's a string, try to parse it
    if (typeof jsonMetadata === "string") {
      parsed = JSON.parse(jsonMetadata);
    }

    // If the result is still a string (double-encoded), parse again
    if (typeof parsed === "string") {
      parsed = JSON.parse(parsed);
    }

    // Return the parsed object if it has the expected structure
    if (parsed && typeof parsed === "object") {
      return {
        image: Array.isArray(parsed.image) ? parsed.image : undefined,
        thumbnail: Array.isArray(parsed.thumbnail)
          ? parsed.thumbnail
          : undefined,
      };
    }
  } catch (error) {
    console.warn("Failed to parse json_metadata:", error);
  }

  return null;
}

// Function to extract image URLs from markdown content
function extractImageFromMarkdown(markdownContent: string): string | null {
  if (!markdownContent) return null;

  // Regex patterns to match different image formats in markdown
  const imagePatterns = [
    // Standard markdown images: ![alt](url)
    /!\[.*?\]\((https?:\/\/[^\s\)]+(?:\.[a-zA-Z]{2,4})(?:\/[^\s\)]*)?)\)/i,
    // HTML img tags: <img src="url" />
    /<img[^>]+src=["']([^"']+)["'][^>]*>/i,
    // Direct image URLs (common image extensions)
    /(https?:\/\/[^\s]+\.(?:jpg|jpeg|png|gif|webp|bmp|svg)(?:\?[^\s]*)?)/i,
  ];

  for (const pattern of imagePatterns) {
    const match = markdownContent.match(pattern);
    if (match && match[1]) {
      // Validate that the URL looks like an image
      const url = match[1];
      if (
        url.match(/\.(jpg|jpeg|png|gif|webp|bmp|svg)(\?|$)/i) ||
        url.includes("image") ||
        url.includes("img")
      ) {
        return url;
      }
    }
  }

  return null;
}

// Check for object permlinks only
function validatePermlink(permlink: any, source: string) {
  if (
    typeof permlink === "object" ||
    (typeof permlink === "string" && permlink.includes("[object"))
  ) {
    console.error(`🚨 OBJECT PERMLINK in ${source}:`, {
      permlink,
      type: typeof permlink,
      stack: new Error().stack?.split("\n").slice(2, 5).join("\n"),
    });
    throw new Error(`Invalid permlink: ${String(permlink)}`);
  }
}

async function getData(user: string, permlink: string) {
  validatePermlink(permlink, "getData");
  try {
    const cleanUser = user.startsWith("@") ? user.slice(1) : user;
    console.log("Fetching post content for:", {
      user: cleanUser,
      permlink,
    });
    const postContent = await HiveClient.database.call("get_content", [
      cleanUser,
      permlink,
    ]);

    if (!postContent || !postContent.author) {
      throw new Error("Post not found");
    }

    return postContent;
  } catch (error) {
    console.error("Failed to fetch post content:", error);

    // Log the detailed error information for debugging
    if (error && typeof error === "object") {
      const errorObj = error as any;
      console.error("Error details:", {
        message: errorObj.message,
        jse_shortmsg: errorObj.jse_shortmsg,
        jse_info: errorObj.jse_info,
      });
    }

    throw new Error("Failed to fetch post content");
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ author: string; permlink: string }>;
}): Promise<Metadata> {
  const { author, permlink } = await params;

  validatePermlink(permlink, "generateMetadata");

  // Quick validation to catch object permlinks
  if (typeof permlink !== "string") {
    console.error("generateMetadata: permlink is not a string:", {
      author,
      permlink,
    });
    return {
      title: "Post | Skatehive",
      description: "View this post on Skatehive.",
    };
  }

  try {
    const decodedAuthor = decodeURIComponent(author);
    const post = await getData(decodedAuthor, permlink);
    const cleanedAuthor = cleanUsername(post.author);
    const title = post.title || "Untitled Post";
    const description = post.body
      ? `${String(post.body).slice(0, 128)}...`
      : "No description available";

    // Extract images from markdown using regex (similar to old approach)
    const images = post.body ? post.body.match(/!\[.*?\]\((.*?)\)/g) : [];
    const imageUrls = images
      ? images.map((img: string) => {
          const match = img.match(/\((.*?)\)/);
          return match ? match[1] : "";
        })
      : [];

    // Parse JSON metadata for additional images
    const parsedMetadata = parseJsonMetadata(post.json_metadata);

    // Get banner image with priority: json_metadata.thumbnail, json_metadata.image, markdown images, fallback
    let bannerImage = FALLBACK_IMAGE;
    if (parsedMetadata?.thumbnail && parsedMetadata.thumbnail[0]) {
      bannerImage = parsedMetadata.thumbnail[0];
    } else if (parsedMetadata?.image && parsedMetadata.image[0]) {
      bannerImage = parsedMetadata.image[0];
    } else if (imageUrls[0]) {
      bannerImage = imageUrls[0];
    }

    if (typeof permlink !== "string") {

      console.error(
        "generateMetadata: non-string permlink when building URL",
        permlink,
      );
      throw new Error("Invalid permlink type");
    }

    const postUrl = `${DOMAIN_URL}/post/${encodeURIComponent(
      cleanedAuthor,
    )}/${encodeURIComponent(permlink)}`;

    console.log("Generated metadata:", {
      title,
      description,
      bannerImage,
      postUrl,
    });

    return {
      title: title,
      description: description,
      authors: [{ name: cleanedAuthor }],
      applicationName: "Skatehive",
      openGraph: {
        title: title,
        description: description,
        url: postUrl,
        images: [
          {
            url: bannerImage,
            width: 1200,
            height: 630,
          },
        ],
        siteName: "Skatehive",
        type: "article",
      },
      twitter: {
        card: "summary_large_image",
        title: title,
        description: description,
        images: bannerImage,
      },
      other: {
        "fc:frame": JSON.stringify({
          version: "next",
          imageUrl: bannerImage,
          button: {
            title: "Open post",
            action: {
              type: "launch_frame",
              name: "Skatehive",
              url: postUrl,
            },
          },
          postUrl: postUrl,
        }),
        "fc:frame:image": bannerImage,
        "fc:frame:post_url": postUrl,
      },
    };
  } catch (error) {
    console.error("Error generating post metadata:", error);
    return {
      title: "Post | Skatehive",
      description: "View this post on Skatehive.",
    };
  }
}

export default async function PostPageRoute({
  params,
}: {
  params: Promise<{ author: string; permlink: string }>;
}) {
  const { author, permlink } = await params;

  validatePermlink(permlink, "PostPageRoute");

  // Log any problematic permlinks for debugging
  if (
    typeof permlink !== "string" ||
    permlink.includes("[object") ||
    permlink.includes("%5B")
  ) {
    console.error("PostPageRoute: problematic permlink detected:", {
      author,
      permlink,
      permlinkType: typeof permlink,
    });

    // Return a safe error page instead of trying to process invalid permlink
    return (
      <div style={{ padding: "20px", textAlign: "center" }}>
        <h1>Invalid Post URL</h1>
        <p>The post URL contains invalid parameters.</p>
      </div>
    );
  }

  const decodedAuthor = decodeURIComponent(author);
  const decodedPermlink = decodeURIComponent(permlink);

  return (
    <PostPage
      author={cleanUsername(decodedAuthor)}
      permlink={decodedPermlink}
    />
  );
}

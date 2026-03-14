import { Discussion } from "@hiveio/dhive";
import { fetchComments } from "@/lib/hive/fetchComments";
import { filterAutoComments } from "./postUtils";
import { APP_CONFIG } from "@/config/app.config";

export interface MediaItem {
  type: "image" | "video" | "iframe";
  content: string;
  src?: string;
}

/**
 * Fetch replies for a given author/permlink and apply quality filtering
 */
export async function fetchFilteredReplies(author: string, permlink: string): Promise<Discussion[]> {
    try {
        const replies = await fetchComments(author, permlink, false);
        // Apply quality filtering to replies
        return filterAutoComments(replies);
    } catch (error) {
        console.error("Failed to fetch filtered replies:", error);
        return [];
    }
}

export const separateContent = (body: string) => {
    // First remove the last URL if it's at the end of the content
    const cleanedBody = removeLastUrlFromContent(body);
    
    const textParts: string[] = [];
    const mediaParts: string[] = [];
    const lines = cleanedBody.split("\n");
    lines.forEach((line: string) => {
        if (line.match(/!\[.*?\]\(.*\)/) || line.match(/<iframe.*<\/iframe>/)) {
            mediaParts.push(line);
        } else {
            textParts.push(line);
        }
    });
    return { text: textParts.join("\n"), media: mediaParts.join("\n") };
};

// Extract the last URL from content for OpenGraph preview
export const extractLastUrl = (content: string): string | null => {
  const urlRegex = /https?:\/\/[^\s<>"'`]+/g;
  const urls: string[] = [];
  let match;
  
  while ((match = urlRegex.exec(content)) !== null) {
    const url = match[0];
    
    // Skip if it's already handled by other systems
    if (
      // Skip image URLs
      url.match(/\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i) ||
      // Skip video URLs
      url.match(/\.(mp4|webm|mov|avi|wmv|flv|mkv)$/i) ||
      // Skip YouTube URLs (handled by markdown processor)
      url.includes('youtube.com') ||
      url.includes('youtu.be') ||
      // Skip 3speak URLs
      url.includes('3speak.tv') ||
      // Skip Instagram URLs
      url.includes('instagram.com') ||
      // Skip Vimeo URLs
      url.includes('vimeo.com') ||
      // Skip Odysee URLs
      url.includes('odysee.com') ||
      // Skip game URLs (handled by game cartridge renderer)
      url.includes('skatehive.app/games') ||
      // Skip IPFS URLs
      url.includes('ipfs')
      // Skip Hive Imaages URLs
        || url.includes('images.hive.blog')
      // Skip Farcaster Urls
      || url.includes('farcaster.xyz')
      // Skip imgbb urls 
      || url.includes('ibb.co')
      // skip imgurl urls
      || url.includes('imgurl')
      // skip videoSchema.org urls
      || url.includes('schema.org')
      // skip gnars.com 
      || url.includes('gnars.com')
      // skit media.tenor
      || url.includes('media.tenor.com')
      // skip https://html5-game-skatehive.vercel.app/QFShive/index.html
      || url.includes('html5-game-skatehive.vercel.app/QFShive/index.html')
    ) {
      continue;
    }
    
    urls.push(url);
  }
  
  if (urls.length === 0) return null;
  
  const lastUrl = urls[urls.length - 1];
  
  // Check if the URL is at the very end of the content (with minimal trailing content)
  const urlPosition = content.lastIndexOf(lastUrl);
  const afterUrl = content.substring(urlPosition + lastUrl.length).trim();
  
  // Hide the URL if it's at the end with only whitespace or minimal punctuation after it
  if (afterUrl === '' || afterUrl.match(/^[\s\n.!?]*$/)) {
    // Return the URL but mark it as "end-url" so we can hide it in the text
    return lastUrl;
  }
  
  return lastUrl;
};

// Function to remove the last URL from content if it's at the end
export const removeLastUrlFromContent = (content: string): string => {
  const lastUrl = extractLastUrl(content);
  if (!lastUrl) return content;
  
  // Don't remove Zora coin URLs or game URLs as they should be rendered as special previews
  if (lastUrl.includes('zora.co/coin') || lastUrl.includes('skatehive.app/coin') || lastUrl.includes('skatehive.app/games')) {
    return content;
  }
  
  const urlPosition = content.lastIndexOf(lastUrl);
  const afterUrl = content.substring(urlPosition + lastUrl.length).trim();
  
  // Only remove if it's at the end with minimal trailing content
  if (afterUrl === '' || afterUrl.match(/^[\s\n.!?]*$/)) {
    return content.substring(0, urlPosition).trim();
  }
  
  return content;
};

// Helper function to check if a URL is a video file based on extension
const isVideoUrl = (url: string): boolean => {
  const videoExtensions = ['.mp4', '.webm', '.mov', '.avi', '.wmv', '.flv', '.mkv', '.m4v'];
  const lowercaseUrl = url.toLowerCase();
  return videoExtensions.some(ext => lowercaseUrl.includes(ext));
};

// Helper function to detect IPFS URLs from various gateways
const isIpfsUrl = (url: string): boolean => {
  return (
    url.includes('/ipfs/') || 
    url.includes('ipfs.') ||
    url.includes('.ipfs.') ||
    url.includes('pinata.cloud') ||
    url.includes('gateway.pinata.cloud') ||
    url.includes('mypinata.cloud') ||
    url.includes(APP_CONFIG.IPFS_GATEWAY) ||
    url.includes('ipfs.io') ||
    url.includes('cloudflare-ipfs.com') ||
    url.includes('dweb.link') ||
    url.includes('nftstorage.link') ||
    url.includes('w3s.link') ||
    url.includes('.mypinata.cloud') ||
    url.startsWith('ipfs://')
  );
};

// Helper function to extract IPFS hash from any IPFS URL
const extractIpfsHash = (url: string): string | null => {
  const ipfsMatch = url.match(/\/ipfs\/([a-zA-Z0-9]{46,})/);
  return ipfsMatch ? ipfsMatch[1] : null;
};

// Helper function to convert any IPFS URL to skatehive gateway
const convertToSkatehiveGateway = (url: string): string => {
  const hash = extractIpfsHash(url);
  return hash ? `https://${APP_CONFIG.IPFS_GATEWAY}/ipfs/${hash}` : url;
};

export const parseMediaContent = (mediaContent: string): MediaItem[] => {
  const mediaItems: MediaItem[] = [];

  mediaContent.split("\n").forEach((item: string) => {
    const trimmedItem = item.trim();
    if (!trimmedItem) return;

    // Handle markdown images/videos with any IPFS gateway
    if (trimmedItem.includes("![") && trimmedItem.includes("http")) {
      // Extract the URL from markdown syntax
      const urlMatch = trimmedItem.match(/!\[.*?\]\((.*?)\)/);
      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];
        
        // Check if it's an IPFS URL
        if (isIpfsUrl(url)) {
          // Convert to skatehive gateway for consistency
          const skatehiveUrl = convertToSkatehiveGateway(url);
          
          // Check if it's a video based on URL or assume video for IPFS without clear extension
          if (isVideoUrl(url)) {
            mediaItems.push({
              type: "video",
              content: trimmedItem,
              src: skatehiveUrl,
            });
          } else {
            // For IPFS URLs without clear video extension, we could check content-type
            // For now, treat as image but this could be enhanced
            mediaItems.push({
              type: "image",
              content: trimmedItem,
            });
          }
          return;
        }
        
        // Handle non-IPFS URLs
        if (isVideoUrl(url)) {
          mediaItems.push({
            type: "video",
            content: trimmedItem,
            src: url,
          });
        } else {
          mediaItems.push({
            type: "image",
            content: trimmedItem,
          });
        }
        return;
      }
    }

    // Handle markdown images/videos with ipfs: protocol
    if (trimmedItem.includes("![") && trimmedItem.includes("ipfs:")) {
      const urlMatch = trimmedItem.match(/!\[.*?\]\((.*?)\)/);
      if (urlMatch && urlMatch[1]) {
        const url = urlMatch[1];
        if (isVideoUrl(url)) {
          mediaItems.push({
            type: "video",
            content: trimmedItem,
            src: url,
          });
        } else {
          mediaItems.push({
            type: "image",
            content: trimmedItem,
          });
        }
        return;
      }
    }

    // Handle iframes
    if (trimmedItem.includes("<iframe") && trimmedItem.includes("</iframe>")) {
      const srcMatch = trimmedItem.match(/src=["']([^"']+)["']/i);
      if (srcMatch && srcMatch[1]) {
        const url = srcMatch[1];

        // Skip YouTube iframes (handled by auto-embed logic)
        if (
          url.includes("youtube.com/embed/") ||
          url.includes("youtube-nocookie.com/embed/") ||
          url.includes("youtu.be/")
        ) {
          return;
        }

        // Handle IPFS videos from any gateway
        if (isIpfsUrl(url)) {
          const skatehiveUrl = convertToSkatehiveGateway(url);
          mediaItems.push({
            type: "video",
            content: trimmedItem,
            src: skatehiveUrl,
          });
          return;
        }
      }

      // Other iframes
      mediaItems.push({
        type: "iframe",
        content: trimmedItem,
      });
      return;
    }
  });

  return mediaItems;
};

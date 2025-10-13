import { processMediaContent } from "@/lib/markdown/MarkdownRenderer";
import { extractZoraCoinLinks } from "@/lib/utils/extractImageUrls";
import { isSnapshotUrl } from "@/lib/utils/snapshotUtils";
import { LRUCache } from "@/lib/utils/LRUCache";
import { getCacheKey } from "@/lib/utils/hashUtils";

export interface ProcessedMarkdown {
  originalContent: string;
  processedContent: string;
  contentWithPlaceholders: string;
  hasInstagramEmbeds: boolean;
  videoPlaceholders: VideoPlaceholder[];
}

export interface VideoPlaceholder {
  type: 'VIDEO' | 'ODYSEE' | 'YOUTUBE' | 'VIMEO' | 'ZORACOIN' | 'SNAPSHOT';
  id: string;
  placeholder: string;
}

// LRU cache for processed markdown (max 500 entries, 30 min TTL)
// Cache keys are deterministic hashes instead of full markdown strings for memory efficiency
// Uses browser-safe FNV-1a hash algorithm that works in both Node.js and browser
const markdownProcessingCache = new LRUCache<string, ProcessedMarkdown>(
  500,
  30 * 60 * 1000 // 30 minutes in milliseconds
);

export class MarkdownProcessor {
  static process(content: string): ProcessedMarkdown {
    // Generate hash-based cache key for memory efficiency
    const cacheKey = getCacheKey(content);
    
    // Check cache first
    const cached = markdownProcessingCache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Step 1: Process media content (from existing MarkdownRenderer)
    const processedContent = processMediaContent(content);

    // Step 2: Convert Zora coin links to placeholders  
    const contentWithZoraPlaceholders = this.convertZoraCoinLinksToPlaceholders(processedContent);

    // Step 3: Convert Snapshot links to placeholders
    const contentWithSnapshotPlaceholders = this.convertSnapshotLinksToPlaceholders(contentWithZoraPlaceholders);

    // Step 4: Extract video placeholders and convert to our format
    const contentWithPlaceholders = this.convertToVideoPlaceholders(contentWithSnapshotPlaceholders);

    // Step 4: Detect Instagram embeds
    const hasInstagramEmbeds = processedContent.includes("<!--INSTAGRAM_EMBED_SCRIPT-->");

    // Step 5: Extract video placeholder information
    const videoPlaceholders = this.extractVideoPlaceholders(contentWithPlaceholders);

    const result: ProcessedMarkdown = {
      originalContent: content,
      processedContent,
      contentWithPlaceholders,
      hasInstagramEmbeds,
      videoPlaceholders,
    };

    // Cache the result using hash key
    markdownProcessingCache.set(cacheKey, result);
    return result;
  }

  private static convertZoraCoinLinksToPlaceholders(content: string): string {
    const zoraCoinLinks = extractZoraCoinLinks(content);
    
    let processedContent = content;
    
    zoraCoinLinks.forEach(addressWithChain => {
      // Extract just the address part (remove chain prefix if present)
      const address = addressWithChain.includes(':') ? addressWithChain.split(':')[1] : addressWithChain;
      
      // Replace both zora.co and skatehive.app URLs
      const zoraUrl = `https://zora.co/coin/${addressWithChain}`;
      const skatehiveUrl = `https://skatehive.app/coin/${addressWithChain}`;
      const placeholder = `[[ZORACOIN:${address}]]`;
      
      processedContent = processedContent.replace(zoraUrl, placeholder);
      processedContent = processedContent.replace(skatehiveUrl, placeholder);
    });
    
    return processedContent;
  }

  private static convertSnapshotLinksToPlaceholders(content: string): string {
    // Match standalone Snapshot URLs (on their own line)
    const snapshotUrlRegex = /^(https?:\/\/(?:www\.)?(snapshot\.(?:org|box)|demo\.snapshot\.org)\/.+)$/gm;
    
    return content.replace(snapshotUrlRegex, (match, url) => {
      // Only convert if it's a valid Snapshot URL
      if (isSnapshotUrl(url)) {
        return `[[SNAPSHOT:${url}]]`;
      }
      return match;
    });
  }

  private static convertToVideoPlaceholders(content: string): string {
    return content.replace(
      /<div class="video-embed" data-ipfs-hash="([^"]+)">[\s\S]*?<\/div>/g,
      (_, videoID) => `[[VIDEO:${videoID}]]`
    );
  }

  private static extractVideoPlaceholders(content: string): VideoPlaceholder[] {
    const placeholders: VideoPlaceholder[] = [];
    const regex = /\[\[(VIDEO|ODYSEE|YOUTUBE|VIMEO|ZORACOIN|SNAPSHOT):([^\]]+)\]\]/g;
    let match;

    while ((match = regex.exec(content)) !== null) {
      placeholders.push({
        type: match[1] as 'VIDEO' | 'ODYSEE' | 'YOUTUBE' | 'VIMEO' | 'ZORACOIN' | 'SNAPSHOT',
        id: match[2],
        placeholder: match[0],
      });
    }

    return placeholders;
  }

  static clearCache(): void {
    markdownProcessingCache.clear();
  }
}

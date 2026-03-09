/**
 * SEO Metadata Generation Utilities
 * Extracts and formats metadata from post content for better search indexing
 */

/**
 * Generate description from post body (first 155 chars, SEO optimized)
 */
export function generateDescription(body: string, maxLength = 155): string {
  const clean = body
    .replace(/!\[.*?\]\(.*?\)/g, '') // Remove markdown images
    .replace(/<[^>]+>/g, '')          // Remove HTML tags
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Keep link text only
    .replace(/[#*_~`]/g, '')          // Remove markdown formatting
    .replace(/\n+/g, ' ')             // Newlines to spaces
    .trim();
  
  if (clean.length <= maxLength) return clean;
  
  // Cut at last word boundary before maxLength
  const truncated = clean.substring(0, maxLength - 3);
  const lastSpace = truncated.lastIndexOf(' ');
  
  return (lastSpace > 0 ? truncated.substring(0, lastSpace) : truncated) + '...';
}

/**
 * Extract all image URLs from markdown content
 */
export function extractImages(markdown: string): string[] {
  const imageRegex = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  const iframeRegex = /<img[^>]+src=["']([^"']+)["']/g;
  
  const images: string[] = [];
  let match;
  
  // Extract from markdown syntax
  while ((match = imageRegex.exec(markdown)) !== null) {
    images.push(match[1]);
  }
  
  // Extract from HTML img tags
  while ((match = iframeRegex.exec(markdown)) !== null) {
    images.push(match[1]);
  }
  
  return [...new Set(images)]; // Remove duplicates
}

/**
 * Extract video URLs and metadata from markdown content
 */
export function extractVideos(markdown: string): Array<{ url: string; type: string }> {
  const videos: Array<{ url: string; type: string }> = [];
  
  // Extract from iframes
  const iframeRegex = /<iframe[^>]+src=["']([^"']+)["']/gi;
  let match;
  
  while ((match = iframeRegex.exec(markdown)) !== null) {
    const url = match[1];
    
    // Determine video type
    let type = 'video';
    if (url.includes('youtube.com') || url.includes('youtu.be')) {
      type = 'youtube';
    } else if (url.includes('3speak')) {
      type = '3speak';
    } else if (url.includes('ipfs')) {
      type = 'ipfs';
    }
    
    videos.push({ url, type });
  }
  
  return videos;
}

/**
 * Detect post category from tags
 */
export function detectCategory(tags: string[]): string {
  const lowerTags = tags.map(t => t.toLowerCase());
  
  // Check for specific categories
  if (lowerTags.some(t => ['spot', 'skatepark', 'diy', 'street'].includes(t))) {
    return 'spot';
  }
  
  if (lowerTags.some(t => ['trick', 'tutorial', 'howto'].includes(t))) {
    return 'trick';
  }
  
  if (lowerTags.some(t => ['bounty', 'challenge', 'contest'].includes(t))) {
    return 'bounty';
  }
  
  if (lowerTags.some(t => ['news', 'announcement', 'update'].includes(t))) {
    return 'news';
  }
  
  if (lowerTags.some(t => ['gear', 'review', 'setup'].includes(t))) {
    return 'gear';
  }
  
  // Default categories
  return 'article';
}

/**
 * Extract skateboarding trick keywords from text
 */
export function extractTrickKeywords(text: string): string[] {
  const lowerText = text.toLowerCase();
  
  const trickKeywords = [
    'kickflip', 'heelflip', 'ollie', 'nollie', 'fakie',
    'grind', 'boardslide', 'nosegrind', 'tailslide', 'noseslide',
    'manual', 'nosemanual', '360 flip', 'varial flip', 'hardflip',
    'backside', 'frontside', 'switch', 'halfcab',
    'rock to fakie', 'drop in', 'air', 'grab',
    'impossible', 'shove-it', 'pop shove-it',
    'feeble', 'smith', 'crooked', 'salad', '5-0'
  ];
  
  const found = trickKeywords.filter(trick => {
    // Match whole words or with common variations
    const pattern = new RegExp(`\\b${trick}(?:s|ed|ing)?\\b`, 'i');
    return pattern.test(lowerText);
  });
  
  return found;
}

/**
 * Clean and format filename for use as alt text
 */
export function cleanFilename(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')         // Remove extension
    .replace(/[-_]/g, ' ')           // Replace dashes/underscores with spaces
    .replace(/\d{8,}/g, '')          // Remove long number sequences (timestamps)
    .replace(/IMG|PANO|DSC|DCIM/gi, '') // Remove camera prefixes
    .trim()
    .replace(/\s+/g, ' ');           // Normalize whitespace
}

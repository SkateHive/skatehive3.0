// Helper function to validate image URLs
function isValidImageUrl(url: string): boolean {
    try {
        const parsedUrl = new URL(url);
        // Check if it's a valid protocol
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return false;
        }
        
        // Check if it's a valid image extension or IPFS URL
        const pathname = parsedUrl.pathname.toLowerCase();
        const validExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg', '.bmp'];
        const hasValidExtension = validExtensions.some(ext => pathname.endsWith(ext));
        const isIpfsUrl = url.includes('ipfs') || url.includes('bafy');
        
        // For IPFS URLs, check if they have a filename parameter with extension
        if (isIpfsUrl) {
            // Check if URL has a filename parameter with valid extension
            const filenameMatch = url.match(/[?&]filename=.*\.(jpg|jpeg|png|gif|webp|svg|bmp)/i);
            if (filenameMatch) {
                return true;
            }
            // Also allow IPFS URLs without filename parameter (for backward compatibility)
            return true;
        }
        
        return hasValidExtension;
    } catch {
        return false;
    }
}

export function extractImageUrls(markdown: string): string[] {
    const imageRegex = /!\[.*?\]\((.*?)\)/g;

    const matches: string[] = [];
    let match;

    while ((match = imageRegex.exec(markdown)) !== null) {
        const url = match[1];
        // Only add valid image URLs
        if (isValidImageUrl(url)) {
            matches.push(url);
        }
    }

    return matches;
}

export interface LinkWithDomain {
    url: string
    domain: string
    thumbnail?: string
}

export function extractCustomLinks(inputText: string): LinkWithDomain[] {
    const customLinkRegex = /https:\/\/3speak\.tv\/watch\?v=[\w\d\-\/]+/gi
    const customLinks = inputText.match(customLinkRegex) || []

    const customLinkSet = new Set<string>()
    const customLinksWithDomains: LinkWithDomain[] = []

    for (const link of customLinks) {
        if (!customLinkSet.has(link)) {
            customLinkSet.add(link)
            const parsedUrl = new URL(link)
            const domain = parsedUrl.hostname || ""
            customLinksWithDomains.push({
                url: link.replace("watch", "embed"),
                domain,
            })
        }
    }

    return customLinksWithDomains
}

// Add new function to extract YouTube links
export function extractYoutubeLinks(content: string): LinkWithDomain[] {
    const regex = /(?:<iframe[^>]*src=["'](?:https?:)?\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:[^"'\s>]*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})[^"']*["'][^>]*><\/iframe>|https?:\/\/(?:www\.)?(?:youtube(?:-nocookie)?\.com\/(?:embed\/|watch\?(?:[^\s]*&)?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})[^\s]*)/gi;
    const links: LinkWithDomain[] = [];
    let match;
    while ((match = regex.exec(content)) !== null) {
        const videoID = match[1] || match[2];
        if (!videoID) continue;
        // Use the nocookie domain with controls disabled to help prevent logging requests
        const embedUrl = `https://www.youtube-nocookie.com/embed/${videoID}?controls=0`;
        // mqdefault is a native 320x180 16:9 frame (no black bars) that always exists
        const thumbnail = `https://img.youtube.com/vi/${videoID}/mqdefault.jpg`;
        links.push({ url: embedUrl, domain: "youtube.com", thumbnail });
    }
    return links;
}

// Extract video URLs from markdown (iframe and direct video links)
export function extractVideoUrls(markdown: string): string[] {
    const videoUrls: string[] = [];
    // Match <iframe src="...">
    const iframeRegex = /<iframe[^>]*src=["']([^"']+)["'][^>]*><\/iframe>/g;
    let match;
    while ((match = iframeRegex.exec(markdown)) !== null) {
        videoUrls.push(match[1]);
    }
    // Match direct video links in markdown image syntax (e.g., ![desc](url.mp4))
    const videoImageRegex = /!\[.*?\]\((.*?\.(mp4|webm|mov|avi|wmv|flv|mkv))\)/gi;
    while ((match = videoImageRegex.exec(markdown)) !== null) {
        videoUrls.push(match[1]);
    }
    return videoUrls;
}

// Extract Zora coin contract addresses from text (supports both zora.co and skatehive.app)
export function extractZoraCoinLinks(text: string): string[] {
    const coinRegex = /https:\/\/(?:www\.)?(?:zora\.co|skatehive\.app)\/coin\/([a-zA-Z0-9:]+)/g
    const addresses: string[] = []

    let match

    // Extract from supported domains in textual order
    while ((match = coinRegex.exec(text)) !== null) {
        addresses.push(match[1])
    }
    
    return addresses
}

// Extract general URLs from text (excluding images, videos, and already handled services)
export function extractGeneralUrls(text: string): string[] {
    const urlRegex = /https?:\/\/[^\s<>"'`]+/g;
    const urls: string[] = [];
    let match;
    
    while ((match = urlRegex.exec(text)) !== null) {
        const url = match[0];
        
        // Skip if it's already handled by other extractors
        if (
            // Skip image URLs
            isValidImageUrl(url) ||
            // Skip video URLs
            url.match(/\.(mp4|webm|mov|avi|wmv|flv|mkv)$/i) ||
            // Skip YouTube URLs (handled by extractYoutubeLinks)
            url.includes('youtube.com') ||
            url.includes('youtu.be') ||
            // Skip 3speak URLs (handled by extractCustomLinks)
            url.includes('3speak.tv') ||
            // Skip Zora URLs (handled by extractZoraCoinLinks)
            url.includes('zora.co/coin') ||
            // Skip Instagram URLs (handled by markdown processor)
            url.includes('instagram.com') ||
            // Skip Vimeo URLs (handled by markdown processor)
            url.includes('vimeo.com') ||
            // Skip Odysee URLs (handled by markdown processor)
            url.includes('odysee.com')
        ) {
            continue;
        }
        
        urls.push(url);
    }
    
    // Return only the last URL to avoid cluttering
    return urls.length > 0 ? [urls[urls.length - 1]] : [];
}

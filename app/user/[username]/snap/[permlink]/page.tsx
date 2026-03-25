import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import HiveClient from '@/lib/hive/hiveclient';
import { Discussion } from '@hiveio/dhive';
import { APP_CONFIG } from '@/config/app.config';

interface Props {
    params: Promise<{
        username: string;
        permlink: string;
    }>;
}

// Known bot user agents that need full HTML content for indexing
const BOT_UA_PATTERNS = [
    'googlebot', 'bingbot', 'yandex', 'baiduspider', 'duckduckbot',
    'slurp', 'facebookexternalhit', 'twitterbot', 'linkedinbot',
    'whatsapp', 'telegrambot', 'discordbot', 'applebot',
];

function isBot(userAgent: string): boolean {
    const ua = userAgent.toLowerCase();
    return BOT_UA_PATTERNS.some(bot => ua.includes(bot));
}

// Server-side function to fetch post data with caching
async function fetchPostData(username: string, permlink: string): Promise<Discussion | null> {
    try {
        const postContent = await HiveClient.database.call('get_content', [username, permlink]);

        if (postContent && postContent.permlink === permlink) {
            return postContent as Discussion;
        }

        return null;
    } catch (error) {
        console.error('Error fetching post:', error);
        return null;
    }
}

// Clean markdown for description
function cleanBodyForDescription(body: string): string {
    return body
        .replace(/!\[.*?\]\(.*?\)/g, '')       // Remove image markdown
        .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
        .replace(/<[^>]*>/g, '')               // Remove HTML tags
        .replace(/^#{1,6}\s+/gm, '')           // Remove headers
        .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1') // Remove bold/italic
        .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')  // Remove links, keep text
        .replace(/\n\s*\n/g, ' ')              // Remove extra line breaks
        .replace(/\s{2,}/g, ' ')               // Collapse spaces
        .trim();
}

// Server-side metadata generation
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username, permlink } = await params;

    try {
        const post = await fetchPostData(username, permlink);

        if (!post) {
            return {
                title: 'Snap not found - SkateHive',
                description: 'The requested snap could not be found.',
            };
        }

        // Extract first image from post body for og:image
        const imageMatch = post.body.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/);
        const imageUrl = imageMatch ? imageMatch[1] : null;

        // Clean the body text for description
        const cleanBody = cleanBodyForDescription(post.body);
        const descText = cleanBody.length > 155
            ? `${cleanBody.slice(0, 155).replace(/\s+\S*$/, '')}...`
            : cleanBody;

        const title = post.title
            ? `${post.title} - @${post.author} | SkateHive`
            : `Snap by @${post.author} | SkateHive`;
        const description = descText || `Check out this snap by @${post.author} on SkateHive - the decentralized skateboarding community.`;
        const url = `${APP_CONFIG.ORIGIN}/user/${username}/snap/${permlink}`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                url,
                type: 'article',
                siteName: 'SkateHive',
                images: imageUrl ? [
                    {
                        url: imageUrl,
                        width: 1200,
                        height: 630,
                        alt: `Snap by ${post.author}`,
                    }
                ] : [{
                    url: `${APP_CONFIG.ORIGIN}/ogimage.png`,
                    width: 1200,
                    height: 630,
                    alt: 'SkateHive',
                }],
                authors: [post.author],
                publishedTime: post.created,
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
                images: imageUrl ? [imageUrl] : [`${APP_CONFIG.ORIGIN}/ogimage.png`],
                creator: `@${post.author}`,
            },
            other: {
                "fc:frame": JSON.stringify({
                    version: "next",
                    imageUrl: imageUrl || `${APP_CONFIG.ORIGIN}/ogimage.png`,
                    button: {
                        title: "View Snap",
                        action: { type: "launch_frame", name: "Skatehive", url },
                    },
                    postUrl: url,
                }),
                "fc:frame:image": imageUrl || `${APP_CONFIG.ORIGIN}/ogimage.png`,
                "fc:frame:post_url": url,
            },
            alternates: {
                canonical: url,
            },
        };
    } catch (error) {
        console.error('Error generating metadata for snap:', error);
        return {
            title: 'SkateHive Snap',
            description: 'Share your skate content on SkateHive - the decentralized skateboarding community.',
        };
    }
}

// Render content for bots, redirect for users
export default async function SnapPage({ params }: Props) {
    const { username, permlink } = await params;
    const headersList = await headers();
    const userAgent = headersList.get('user-agent') || '';

    // For regular users: redirect to profile with snap modal
    if (!isBot(userAgent)) {
        redirect(`/user/${username}?view=snaps&snap=${permlink}`);
    }

    // For bots: render actual content so they can index it
    const post = await fetchPostData(username, permlink);

    if (!post) {
        redirect(`/user/${username}?view=snaps`);
    }

    // Extract images from body
    const imageMatches = post.body.match(/!\[.*?\]\((https?:\/\/[^\)]+)\)/g) || [];
    const imageUrls = imageMatches.map((img: string) => {
        const match = img.match(/\((https?:\/\/[^\)]+)\)/);
        return match ? match[1] : '';
    }).filter(Boolean);

    const cleanBody = cleanBodyForDescription(post.body);

    return (
        <article
            style={{
                maxWidth: '600px',
                margin: '0 auto',
                padding: '20px',
                fontFamily: 'system-ui, sans-serif',
            }}
        >
            <h1>{post.title || `Snap by @${post.author}`}</h1>
            <p style={{ color: '#666', fontSize: '14px' }}>
                Posted by <strong>@{post.author}</strong> on {new Date(post.created).toLocaleDateString()}
            </p>
            {imageUrls[0] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                    src={imageUrls[0]}
                    alt={`Snap by ${post.author}`}
                    style={{ maxWidth: '100%', height: 'auto' }}
                />
            )}
            <div>
                <p>{cleanBody}</p>
            </div>
            <footer style={{ marginTop: '20px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
                <p>
                    View on <a href={`${APP_CONFIG.ORIGIN}/user/${username}?view=snaps&snap=${permlink}`}>SkateHive</a>
                </p>
            </footer>
        </article>
    );
}

import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import HiveClient from '@/lib/hive/hiveclient';
import { Discussion } from '@hiveio/dhive';

interface Props {
    params: Promise<{
        username: string;
        permlink: string;
    }>;
}

// Server-side function to fetch post data with caching
async function fetchPostData(username: string, permlink: string): Promise<Discussion | null> {
    try {
        // Try with username as author (most likely case for clean URLs)
        const postContent = await HiveClient.database.call('get_content', [username, permlink]);

        // Check if we got a valid post back
        if (postContent && postContent.permlink === permlink) {
            return postContent as Discussion;
        }

        return null;
    } catch (error) {
        console.error('Error fetching post:', error);
        return null;
    }
}

// Server-side metadata generation
export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const { username, permlink } = await params;

    try {
        // Fetch the post/snap data from Hive blockchain
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
        const cleanBody = post.body
            .replace(/!\[.*?\]\(.*?\)/g, '') // Remove image markdown
            .replace(/<iframe[^>]*>.*?<\/iframe>/gi, '') // Remove iframes
            .replace(/\n\s*\n/g, ' ') // Remove extra line breaks
            .trim()
            .substring(0, 160); // Limit to 160 characters

        const title = `${post.author}'s Snap - SkateHive`;
        const description = cleanBody || `Check out this awesome snap by @${post.author} on SkateHive`;
        const url = `${process.env.NEXT_PUBLIC_BASE_URL || 'https://skatehive.app'}/user/${username}/snap/${permlink}`;

        return {
            title,
            description,
            openGraph: {
                title,
                description,
                url,
                type: 'article',
                images: imageUrl ? [
                    {
                        url: imageUrl,
                        width: 1200,
                        height: 630,
                        alt: `Snap by ${post.author}`,
                    }
                ] : [],
                authors: [post.author],
                publishedTime: post.created,
            },
            twitter: {
                card: 'summary_large_image',
                title,
                description,
                images: imageUrl ? [imageUrl] : [],
                creator: `@${post.author}`,
            },
            alternates: {
                canonical: url,
            },
        };
    } catch (error) {
        console.error('Error generating metadata for snap:', error);
        return {
            title: 'SkateHive Snap',
            description: 'Share your skate content on SkateHive',
        };
    }
}

// This page component redirects to the profile with modal open
export default async function SnapPage({ params }: Props) {
    const { username, permlink } = await params;

    // Redirect to the profile page with view=snaps and snap parameter
    // The client-side code will detect the URL structure and open the modal
    redirect(`/user/${username}?view=snaps&snap=${permlink}`);
}

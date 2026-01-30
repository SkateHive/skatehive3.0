"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { Discussion } from '@hiveio/dhive';
import HiveClient from '@/lib/hive/hiveclient';
import { validateHiveUsernameFormat } from '@/lib/utils/hiveAccountUtils';
import { filterAutoComments } from '@/lib/utils/postUtils';

const SNAP_PAGE_SIZE = 20;

const log = (...args: any[]) => {
    // Toggle here if you want to silence logs
    // return;
    console.info('[Snaps]', ...args);
};

export default function useUserSnaps(username: string) {
    const [snaps, setSnaps] = useState<Discussion[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const fetchedPermlinksRef = useRef<Set<string>>(new Set());
    const initialLoadDoneRef = useRef<boolean>(false);
    const cursorRef = useRef<{ startPermlink: string; beforeDate: string } | null>(null);
    const apiPageRef = useRef<number>(1);

    const resetSnaps = useCallback(() => {
        setSnaps([]);
        setHasMore(true);
        fetchedPermlinksRef.current.clear();
        initialLoadDoneRef.current = false;
        cursorRef.current = null;
        apiPageRef.current = 1;
    }, []);

    // Extract media URLs from snap body content
    const extractMediaFromSnap = (snap: Discussion) => {
        try {
            const body = snap.body || '';
            const allImages: string[] = [];
            const allVideos: string[] = [];

            // 1. Extract URLs from markdown image syntax ![alt](url) → Images
            const markdownImagePattern = /!\[.*?\]\(([^\)]+)\)/gi;
            let match;
            while ((match = markdownImagePattern.exec(body)) !== null) {
                allImages.push(match[1]);
            }

            // 2. Extract src from iframes → Videos
            const iframeSrcPattern = /<iframe[^>]+src=["']([^"']+)["'][^>]*>/gi;
            while ((match = iframeSrcPattern.exec(body)) !== null) {
                allVideos.push(match[1]);
            }

            // 3. Extract media from json_metadata.image
            try {
                const metadata = JSON.parse(snap.json_metadata || '{}');
                const mdImages = Array.isArray(metadata.image)
                    ? metadata.image
                    : (typeof metadata.image === 'string' ? [metadata.image] : []);
                allImages.push(...mdImages);
            } catch {}

            // 4. Extract direct media URLs in body (avoid markdown duplicates and trailing punctuation)
            const cleanedBody = body
                // remove markdown image/link patterns so we don't double-capture
                .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
                .replace(/\[[^\]]*\]\([^)]*\)/g, '');
            const directMediaPattern = /(https?:\/\/[^\s)"']+\.(?:png|jpe?g|gif|webp|mp4|mov|m4v|m3u8))(?=$|\s|[)"'])/gi;
            while ((match = directMediaPattern.exec(cleanedBody)) !== null) {
                const url = match[1];
                if (/\.(mp4|mov|m4v|m3u8)$/i.test(url)) {
                    allVideos.push(url);
                } else {
                    allImages.push(url);
                }
            }

            // Deduplicate and ensure proper URLs
            const uniqueImages = [...new Set(allImages)].map(url =>
                url.startsWith('http') ? url : `https://${url}`
            );
            const uniqueVideos = [...new Set(allVideos)].map(url =>
                url.startsWith('http') ? url : `https://${url}`
            );

            return {
                images: uniqueImages,
                videos: uniqueVideos,
                hasMedia: uniqueImages.length > 0 || uniqueVideos.length > 0
            };
        } catch (error) {
            return { images: [], videos: [], hasMedia: false };
        }
    };

    const hasMedia = (snap: Discussion) => extractMediaFromSnap(snap).hasMedia;

    const fetchUserSnapsFromHive = async (username: string): Promise<{ snaps: Discussion[]; exhausted: boolean }> => {
        try {
            const currentCursor = cursorRef.current || {
                startPermlink: '',
                beforeDate: new Date().toISOString().split('.')[0],
            };

            let accumulated: Discussion[] = [];
            let keepFetching = true;
            let guard = 0;

            while (keepFetching && guard < 10 && accumulated.length < SNAP_PAGE_SIZE) {
                const posts = await HiveClient.call('bridge', 'get_account_posts', {
                    sort: 'posts',
                    account: username,
                    start_author: currentCursor.startPermlink ? username : undefined,
                    start_permlink: currentCursor.startPermlink || undefined,
                    limit: SNAP_PAGE_SIZE,
                    observer: ''
                });

                guard += 1;

                if (!posts.length) {
                    log('Hive: no posts returned', { cursor: currentCursor, guard });
                    keepFetching = false;
                    break;
                }

                const discussions: Discussion[] = posts.map((post: any) => ({
                    ...post,
                    json_metadata: typeof post.json_metadata === 'string'
                        ? post.json_metadata
                        : JSON.stringify(post.json_metadata || {})
                }));

                const mediaSnaps = discussions.filter((snap) => hasMedia(snap) && !fetchedPermlinksRef.current.has(snap.permlink));
                accumulated = [...accumulated, ...mediaSnaps];
                mediaSnaps.forEach((snap) => fetchedPermlinksRef.current.add(snap.permlink));

                log('Hive batch', {
                    guard,
                    posts: posts.length,
                    mediaSnaps: mediaSnaps.length,
                    accumulated: accumulated.length,
                });

                const lastPost = posts[posts.length - 1];
                currentCursor.startPermlink = lastPost?.permlink || currentCursor.startPermlink;
                currentCursor.beforeDate = (lastPost?.created && String(lastPost.created).split('.')[0]) || currentCursor.beforeDate;

                if (posts.length < SNAP_PAGE_SIZE) {
                    keepFetching = false;
                }
            }

            cursorRef.current = { ...currentCursor };
            const exhausted = !keepFetching;
            if (exhausted) {
                setHasMore(false);
            }
            return { snaps: accumulated, exhausted };
        } catch (error) {
            throw error;
        }
    };

    const fetchUserSnapsFromAPI = async (username: string): Promise<{ snaps: Discussion[]; exhausted: boolean }> => {
        const page = apiPageRef.current;
        let apiUrl = `https://api.skatehive.app/api/v2/feed/${encodeURIComponent(username)}?limit=${SNAP_PAGE_SIZE}&page=${page}`;

        const response = await fetch(apiUrl);
        if (!response.ok) {
            throw new Error(`API request failed: ${response.status}`);
        }

        const data = await response.json();
        // debug('User feed API response:', data);

        // Handle different possible response structures
        let userSnaps = [];
        if (data.data && Array.isArray(data.data)) {
            userSnaps = data.data;
        } else if (Array.isArray(data)) {
            userSnaps = data;
        } else if (data.posts && Array.isArray(data.posts)) {
            userSnaps = data.posts;
        } else if (data.result && Array.isArray(data.result)) {
            userSnaps = data.result;
        } else {
            return { snaps: [], exhausted: true };
        }

        // debug(`Found ${userSnaps.length} total snaps for user ${username}`);

        if (userSnaps.length === 0) {
            setHasMore(false);
            return { snaps: [], exhausted: true };
        }

        // Filter out already fetched snaps
        const newSnaps = userSnaps.filter((snap: any) => {
            return snap && snap.permlink && !fetchedPermlinksRef.current.has(snap.permlink);
        });

        // debug(`${newSnaps.length} new snaps after deduplication`);

        if (newSnaps.length > 0) {
            // debug('New user snaps:', newSnaps.map((snap: any) => ({
            //     author: snap.author,
            //     permlink: snap.permlink,
            //     created: snap.created,
            //     bodyPreview: (snap.body || '').substring(0, 200),
            //     hasBody: !!(snap.body),
            //     hasIframe: /<iframe[^>]*>/gi.test(snap.body || ''),
            //     hasMarkdown: /!\[.*?\]\([^\)]+\)/gi.test(snap.body || ''),
            //     hasIpfs: /ipfs\.skatehive\.app/gi.test(snap.body || ''),
            //     hasImagesHive: /images\.hive\.blog/gi.test(snap.body || '')
            // })));

            // Convert to Discussion format
        const discussions: Discussion[] = newSnaps.map((snap: any) => ({
            ...snap,
            json_metadata: (() => {
                if (snap.post_json_metadata) {
                    return JSON.stringify(snap.post_json_metadata);
                } else if (typeof snap.json_metadata === 'string') {
                    return snap.json_metadata;
                } else if (typeof snap.json_metadata === 'object') {
                    return JSON.stringify(snap.json_metadata || {});
                } else {
                    return JSON.stringify({});
                }
            })()
        }));

        const mediaSnaps = discussions.filter((snap) => hasMedia(snap) && !fetchedPermlinksRef.current.has(snap.permlink));

            // debug(`Filtered to ${mediaSnaps.length} snaps with media`);

            // if (mediaSnaps.length > 0) {
            //     debug('Media snaps with extracted media:', mediaSnaps.map(snap => ({
            //         author: snap.author,
            //         permlink: snap.permlink,
            //         bodyPreview: snap.body.substring(0, 200),
            //         media: extractMediaFromSnap(snap)
            //     })));
            // } else if (newSnaps.length > 0) {
            //     debug('Snaps filtered out (no media detected):', newSnaps.map((snap: any) => ({
            //         author: snap.author,
            //         permlink: snap.permlink,
            //         bodyPreview: (snap.body || '').substring(0, 200),
            //         bodyFull: snap.body,
            //         hasIpfsSkate: /ipfs\.skatehive\.app/gi.test(snap.body || ''),
            //         hasImagesHive: /images\.hive\.blog/gi.test(snap.body || ''),
            //         hasMarkdown: /!\[.*?\]\([^\)]+\)/gi.test(snap.body || ''),
            //         hasIframe: /<iframe[^>]*>/gi.test(snap.body || '')
            //     })));
            // }

            // Mark as fetched
            mediaSnaps.forEach(snap => {
                fetchedPermlinksRef.current.add(snap.permlink);
            });

            if (userSnaps.length < SNAP_PAGE_SIZE) {
                setHasMore(false);
            }

            apiPageRef.current = page + 1;

            return { snaps: mediaSnaps, exhausted: userSnaps.length < SNAP_PAGE_SIZE };
        } else {
            // No new snaps, we've probably reached the end
            setHasMore(false);
            return { snaps: [], exhausted: true };
        }
    };

    const fetchUserSnaps = useCallback(async (): Promise<Discussion[]> => {
        log('fetchUserSnaps:start', {
            username,
            cursor: cursorRef.current,
            apiPage: apiPageRef.current,
            fetched: fetchedPermlinksRef.current.size,
        });
        // Validate username to prevent injection attacks
        if (!username || typeof username !== 'string') {
            return [];
        }

        // Validate username format using centralized validation
        const validation = validateHiveUsernameFormat(username);
        if (!validation.isValid) {
            return [];
        }

        try {
            let userSnaps: Discussion[] = [];
            let exhausted = false;

            // Try API method first
            try {
                const apiResult = await fetchUserSnapsFromAPI(username);
                userSnaps = apiResult.snaps;
                exhausted = apiResult.exhausted;

                // If API returns no results, try Hive blockchain as fallback
                if (userSnaps.length === 0) {
                    try {
                        const hiveResult = await fetchUserSnapsFromHive(username);
                        userSnaps = hiveResult.snaps;
                        exhausted = hiveResult.exhausted;
                    } catch (hiveError) {
                        // Still return empty array from API rather than failing completely
                    }
                }
            } catch (apiError) {
                // Fallback to Hive blockchain if API method fails
                try {
                    const hiveResult = await fetchUserSnapsFromHive(username);
                    userSnaps = hiveResult.snaps;
                    exhausted = hiveResult.exhausted;
                } catch (hiveError) {
                    setHasMore(false);
                    return [];
                }
            }

            if (exhausted) {
                setHasMore(false);
            }

            log('fetchUserSnaps:done', {
                returned: userSnaps.length,
                hasMore,
                exhausted,
                cursor: cursorRef.current,
            });
            return userSnaps;
        } catch (error) {
            setHasMore(false);
            return [];
        }
    }, [username]);

    const loadMoreSnaps = useCallback(async () => {
        if (isLoading || !hasMore) return;

        setIsLoading(true);
        try {
            const newSnaps = await fetchUserSnaps();

            if (newSnaps.length === 0) {
                log('loadMoreSnaps: empty batch', {
                    hasMore,
                    cursor: cursorRef.current,
                    fetched: fetchedPermlinksRef.current.size,
                });
            } else {
                log('loadMoreSnaps: appending', { count: newSnaps.length });
                setSnaps(prevSnaps => {
                    const existingPermlinks = new Set(prevSnaps.map(snap => snap.permlink));
                    const uniqueSnaps = newSnaps.filter(snap => !existingPermlinks.has(snap.permlink));
                    return [...prevSnaps, ...uniqueSnaps];
                });
            }
        } catch (error) {
            setHasMore(false);
        } finally {
            setIsLoading(false);
        }
    }, [isLoading, hasMore, fetchUserSnaps]);

    // Reset and load initial snaps when username changes
    useEffect(() => {
        // Skip if no username
        if (!username) return;

        // Reset state for new username
        resetSnaps();

        // Use a flag to prevent double-fetch in StrictMode
        let cancelled = false;

        const loadInitial = async () => {
            if (cancelled) return;

            setIsLoading(true);
            try {
                const newSnaps = await fetchUserSnaps();
                if (cancelled) return;

                if (newSnaps.length > 0) {
                    setSnaps(newSnaps);
                }
            } catch {
                if (!cancelled) setHasMore(false);
            } finally {
                if (!cancelled) setIsLoading(false);
            }
        };

        loadInitial();

        return () => {
            cancelled = true;
        };
    }, [username]); // Only depend on username - resetSnaps and fetchUserSnaps are stable via useCallback

    return {
        snaps: snaps.map(snap => ({
            ...snap,
            media: extractMediaFromSnap(snap)
        })),
        isLoading,
        hasMore,
        loadMoreSnaps,
        resetSnaps
    };
}

import HiveClient from '@/lib/hive/hiveclient';
import { Discussion } from '@hiveio/dhive';
import { useState, useEffect, useRef } from 'react';

interface lastContainerInfo {
  permlink: string;
  date: string;
}

export const useSnaps = () => {
  const lastContainerRef = useRef<lastContainerInfo | null>(null); // Use useRef for last container
  const fetchedPermlinksRef = useRef<Set<string>>(new Set()); // Track fetched permlinks

  const [currentPage, setCurrentPage] = useState(1);
  const [comments, setComments] = useState<Discussion[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  const pageMinSize = 10;


  // Filter comments by the target tag
  function filterCommentsByTag(comments: Discussion[], targetTag: string): Discussion[] {
    return comments.filter((commentItem) => {
      try {
        if (!commentItem.json_metadata) {
          return false; // Skip if json_metadata is empty
        }
        const metadata = JSON.parse(commentItem.json_metadata);
        const tags = metadata.tags || [];
        return tags.includes(targetTag);
      } catch (error) {
        console.error('Error parsing JSON metadata for comment:', commentItem, error);
        return false; // Exclude comments with invalid JSON
      }
    });
  }

  // Fetch comments with a minimum size
  async function getMoreSnaps(): Promise<Discussion[]> {
    const tag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG || ''
    const author = "peak.snaps";
    const limit = 3;
    const allFilteredComments: Discussion[] = [];

    let hasMoreData = true; // To track if there are more containers to fetch
    let permlink = lastContainerRef.current?.permlink || "";
    let date = lastContainerRef.current?.date || new Date().toISOString();

    while (allFilteredComments.length < pageMinSize && hasMoreData) {

      const result = await HiveClient.database.call('get_discussions_by_author_before_date', [
        author,
        permlink,
        date,
        limit,
      ]);

      if (!result.length) {
        hasMoreData = false;
        break;
      }

      for (const resultItem of result) {
        const comments = (await HiveClient.database.call("get_content_replies", [
          author,
          resultItem.permlink,
        ])) as Discussion[];

        const filteredComments = filterCommentsByTag(comments, tag);
        allFilteredComments.push(...filteredComments);

        // Add permlink to the fetched set
        fetchedPermlinksRef.current.add(resultItem.permlink);

        // Update the last container info for the next fetch
        permlink = resultItem.permlink;
        date = resultItem.created;
      }
    }

    // Update the lastContainerRef state for the next API call
    lastContainerRef.current = { permlink, date };

    return allFilteredComments;
  }


  // Convert API item to Discussion format
  function convertApiItemToDiscussion(apiData: any): Discussion {
    return {
      body: apiData.body,
      author: apiData.author,
      permlink: apiData.permlink,
      parent_author: apiData.parent_author,
      parent_permlink: apiData.parent_permlink,
      created: apiData.created,
      cashout_time: apiData.cashout_time,
      last_payout: apiData.last_payout,
      category: apiData.category,
      pending_payout_value: apiData.pending_payout_value,
      author_rewards: apiData.author_rewards,
      total_payout_value: apiData.total_payout_value,
      curator_payout_value: apiData.curator_payout_value,
      beneficiaries: apiData.beneficiaries,
      max_accepted_payout: apiData.max_accepted_payout,
      percent_hbd: apiData.percent_hbd,
      allow_votes: apiData.allow_votes,
      allow_curation_rewards: apiData.allow_curation_rewards,
      net_rshares: apiData.net_rshares,
      total_vote_weight: apiData.total_vote_weight,
      title: '',
      abs_rshares: '',
      children: apiData.children.length,
      reblogged_by: [],
      replies: [],
      vote_rshares: '',
      json_metadata: JSON.stringify(apiData.post_json_metadata || {}),
      author_reputation: parseFloat(apiData.reputation || 0),
      active_votes: apiData.votes?.map((vote: any) => ({
        percent: 0,
        reputation: 0,
        rshares: vote.rshares,
        time: vote.timestamp,
        voter: vote.voter,
        weight: vote.weight
      })) || [],
      url: '',
      root_title: '',
      total_pending_payout_value: '',
      promoted: '',
      body_length: '',
      id: 0,
      last_update: '',
      active: '',
      depth: 0,
      children_abs_rshares: '',
      max_cashout_time: '',
      reward_weight: 0,
      net_votes: 0,
      root_comment: 0,
      allow_replies: true,
    };
  }


  async function fetchFromNewApi(): Promise<Discussion[]> {
    const tag = process.env.NEXT_PUBLIC_HIVE_COMMUNITY_TAG || '';
    const limit = 10;
    const apiUrl = `https://api.skatehive.app/api/v1/feed?limit=${limit}&page=${currentPage}`;
    // const apiUrl = `http://localhost:3001/api/v1/feed?limit=${limit}&page=${currentPage}`;

    const response = await fetch(apiUrl);
    if (!response.ok) {
      console.error('API fetch failed');
      return await getMoreSnaps();
    }

    const apiData = await response.json();
    const discussions: Discussion[] = apiData.data
      .map((item: any) => convertApiItemToDiscussion(item));

    return discussions;
  }

  // Fetch posts when `currentPage` changes
  useEffect(() => {
    const fetchPosts = async () => {
      setIsLoading(true);
      try {
        let newSnaps: Discussion[] = [];

        // Try Hive blockchain method first
        try {
          newSnaps = await getMoreSnaps();
          console.log('Successfully fetched from Hive blockchain');
        } catch (hiveError) {
          console.warn('Hive blockchain fetch failed, falling back to API:', hiveError);
          // Fallback to API if Hive method fails
          try {
            newSnaps = await fetchFromNewApi();
            console.log('Successfully fetched from API fallback');
          } catch (apiError) {
            console.error('Both Hive and API fetch methods failed:', apiError);
            return;
          }
        }

        // console.dir(newSnaps)
        if (newSnaps.length < pageMinSize) {
          setHasMore(false); // No more items to fetch
        }

        // Avoid duplicates in the comments array
        setComments((prevPosts) => {
          const existingPermlinks = new Set(prevPosts.map((post) => post.permlink));
          const uniqueSnaps = newSnaps.filter((snap) => !existingPermlinks.has(snap.permlink));
          return [...prevPosts, ...uniqueSnaps];
        });
      } catch (err) {
        console.error('Error fetching posts:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPosts();
  }, [currentPage]);

  // Load the next page
  const loadNextPage = () => {
    if (!isLoading && hasMore) {
      setCurrentPage((prevPage) => prevPage + 1);
    }
  };

  return { comments, isLoading, loadNextPage, hasMore, currentPage };
};

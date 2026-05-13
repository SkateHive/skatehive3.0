import { NextRequest, NextResponse } from 'next/server';
import { APP_CONFIG, HIVE_CONFIG } from '@/config/app.config';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page = searchParams.get('page') || '1';
    const limit = searchParams.get('limit') || '10';
    
    // Use the external API's pagination directly
    const apiUrl = `${APP_CONFIG.API_BASE_URL}/api/v2/skatespots?limit=${limit}&page=${page}`;
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'Skatehive-App/3.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Filter to only include skatespot posts
    const skatespots = data.data.filter((post: any) => {
      const tags = post.tags || [];
      return tags.includes('skatespot') && tags.includes(HIVE_CONFIG.COMMUNITY_TAG);
    });
    
    // TEMP DEBUG
    if (skatespots[0]) console.log('[skatespots] first raw spot:', JSON.stringify(skatespots[0], null, 2));

    // Transform the data to match the expected Discussion format
    const transformedSpots = skatespots.map((spot: any) => ({
      body: spot.body,
      author: spot.author,
      permlink: spot.permlink,
      parent_author: spot.parent_author,
      parent_permlink: spot.parent_permlink,
      created: spot.created,
      cashout_time: spot.cashout_time,
      last_payout: spot.last_payout,
      category: spot.category,
      pending_payout_value: spot.pending_payout_value,
      author_rewards: spot.author_rewards,
      total_payout_value: spot.total_payout_value,
      curator_payout_value: spot.curator_payout_value,
      beneficiaries: spot.beneficiaries,
      max_accepted_payout: spot.max_accepted_payout,
      percent_hbd: spot.percent_hbd,
      allow_votes: spot.allow_votes,
      allow_curation_rewards: spot.allow_curation_rewards,
      net_rshares: spot.net_rshares,
      total_vote_weight: spot.total_vote_weight,
      title: spot.title || '',
      abs_rshares: '',
      children: 0,
      reblogged_by: [],
      replies: [],
      vote_rshares: '',
      json_metadata: JSON.stringify(spot.json_metadata || spot.post_json_metadata || {}),
      author_reputation: parseFloat(spot.reputation || 0),
      active_votes: spot.votes?.map((vote: any) => ({
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
    }));
    
    // Use the external API's pagination data, but adjust for filtered results
    const limitNum = parseInt(limit);
    const pageNum = parseInt(page);
    
    // If we have filtered results, we need to recalculate pagination
    // But since the external API already returns skatespots, we can use their pagination
    return NextResponse.json({
      success: true,
      data: transformedSpots,
      pagination: {
        total: data.pagination.total,
        totalPages: data.pagination.totalPages,
        currentPage: data.pagination.currentPage,
        limit: data.pagination.limit,
        hasNextPage: data.pagination.hasNextPage,
        hasPrevPage: data.pagination.hasPrevPage,
      }
    });
    
  } catch (error) {
    console.error('Error fetching skatespots:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch skatespots',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 
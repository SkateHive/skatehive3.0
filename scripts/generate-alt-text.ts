#!/usr/bin/env tsx
/**
 * Generate alt text for images in top posts
 * Uses Claude Haiku via Anthropic API to generate descriptive alt text
 * Improves SEO (image search) and accessibility
 * 
 * Usage:
 * tsx scripts/generate-alt-text.ts [--limit=50] [--dry-run]
 */

import HiveClient from '../lib/hive/hiveclient';
import Anthropic from '@anthropic-ai/sdk';

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const DEFAULT_LIMIT = 50;

interface PostImage {
  postAuthor: string;
  postPermlink: string;
  postTitle: string;
  imageUrl: string;
  currentAlt?: string;
}

/**
 * Extract images from markdown body
 */
function extractImages(body: string): string[] {
  const images: string[] = [];
  // Match markdown images: ![alt](url)
  const mdPattern = /!\[.*?\]\((https?:\/\/[^\s)]+)\)/g;
  let match;
  while ((match = mdPattern.exec(body)) !== null) {
    images.push(match[1]);
  }
  return images;
}

/**
 * Fetch top posts from Skatehive community
 */
async function fetchTopPosts(limit: number): Promise<any[]> {
  console.log(`📚 Fetching top ${limit} posts from hive-173115...`);
  
  const posts = await HiveClient.call('bridge', 'get_ranked_posts', {
    sort: 'trending',
    tag: 'hive-173115',
    limit,
  });

  return posts || [];
}

/**
 * Generate alt text for an image using Claude Haiku
 */
async function generateAltText(
  imageUrl: string,
  context: { title: string; author: string },
  client: Anthropic
): Promise<string> {
  try {
    const prompt = `You are an accessibility expert helping create alt text for skateboarding images.

Image URL: ${imageUrl}
Post title: "${context.title}"
Author: @${context.author}

Based on the image URL and post context, generate concise, descriptive alt text (max 125 characters) that:
1. Describes the skateboarding action/trick if discernible from context
2. Mentions the skater if known
3. Is useful for screen readers and SEO
4. Follows accessibility best practices

Examples of good alt text:
- "Skater performing kickflip at street spot"
- "Gnarly grind on handrail by @${context.author}"
- "Skateboard deck with custom grip tape design"

Return ONLY the alt text, no explanation or quotes.`;

    const message = await client.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{ role: 'user', content: prompt }],
    });

    const altText = message.content[0].type === 'text' 
      ? message.content[0].text.trim() 
      : '';

    // Truncate to 125 chars if needed
    return altText.slice(0, 125);
  } catch (error) {
    console.error(`  ❌ Failed to generate alt text: ${error}`);
    return `Skateboarding image by @${context.author}`;
  }
}

/**
 * Main function
 */
async function main() {
  const args = process.argv.slice(2);
  const limitArg = args.find(a => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : DEFAULT_LIMIT;
  const isDryRun = args.includes('--dry-run');

  if (!ANTHROPIC_API_KEY) {
    console.error('❌ ANTHROPIC_API_KEY not set in environment');
    process.exit(1);
  }

  const anthropic = new Anthropic({ apiKey: ANTHROPIC_API_KEY });

  console.log('🎨 Alt Text Generator for Skatehive');
  console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Limit: ${limit} posts\n`);

  // Fetch top posts
  const posts = await fetchTopPosts(limit);
  console.log(`✅ Fetched ${posts.length} posts\n`);

  // Extract images from posts
  const postImages: PostImage[] = [];
  for (const post of posts) {
    const images = extractImages(post.body || '');
    if (images.length === 0) continue;

    // Only process first image per post for efficiency
    postImages.push({
      postAuthor: post.author,
      postPermlink: post.permlink,
      postTitle: post.title || 'Untitled',
      imageUrl: images[0],
    });
  }

  console.log(`🖼️  Found ${postImages.length} posts with images\n`);

  if (postImages.length === 0) {
    console.log('No images to process. Exiting.');
    return;
  }

  // Generate alt text for each image
  const results: Array<{ image: PostImage; altText: string }> = [];
  let processed = 0;
  const total = Math.min(postImages.length, limit);

  for (const image of postImages.slice(0, limit)) {
    processed++;
    console.log(`[${processed}/${total}] Processing: ${image.postTitle.slice(0, 50)}...`);
    console.log(`  Image: ${image.imageUrl.slice(0, 60)}...`);

    const altText = await generateAltText(
      image.imageUrl,
      { title: image.postTitle, author: image.postAuthor },
      anthropic
    );

    console.log(`  ✅ Alt text: "${altText}"\n`);

    results.push({ image, altText });

    // Rate limit: wait 1 second between API calls
    if (processed < total) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // Output results
  console.log('\n📊 Summary:');
  console.log(`Total posts processed: ${results.length}`);
  console.log(`Total API calls: ${results.length}`);
  console.log(`Estimated cost: ~$${(results.length * 0.00025).toFixed(4)} (Claude Haiku)`);

  if (!isDryRun) {
    // Save results to JSON file for manual review
    const fs = await import('fs');
    const outputPath = './alt-text-results.json';
    fs.writeFileSync(outputPath, JSON.stringify(results, null, 2));
    console.log(`\n✅ Results saved to: ${outputPath}`);
    console.log('\n💡 Next steps:');
    console.log('1. Review the generated alt text in alt-text-results.json');
    console.log('2. Manually update post markdown to include alt text:');
    console.log('   Before: ![](imageUrl)');
    console.log('   After:  ![generated alt text](imageUrl)');
    console.log('3. Or integrate this into the post composer for future posts');
  } else {
    console.log('\n(Dry run mode - no files saved)');
  }
}

main().catch(console.error);

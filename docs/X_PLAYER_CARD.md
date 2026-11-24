# X Player Card for Skatehive posts

Skatehive post previews for X use the `twitter:card=player` metadata type. The public share URL is `/embed/{author}/{permlink}`. X reads its title, description, image, and `twitter:player` URL, then loads that URL in a sandboxed player frame when the reader opens the card.

## Share a post

Choose X in the post share menu or copy the embed URL below. Skate spot shares open the dedicated spot page.

```text
https://skatehive.app/embed/{author}/{permlink}
```

For example, `https://skatehive.app/embed/skateuser/example-post`. The regular `/post/{author}/{permlink}` URL remains the full Skatehive page. The embed route currently renders a compact server-side preview with the post cover, a link to its comments and a link to the full post.

## Metadata and framing

The route emits a Player Card with a 640 × 480 player URL. Metadata is rendered server-side so X can read it without running client JavaScript. The app's existing Content Security Policy includes broad iframe framing permission; verify the deployed response headers and X's current sandbox behavior before relying on the card in production.

Player Cards are a legacy X feature and may render differently across web, iOS, Android, and X Articles. Test a regular post on desktop web and the target mobile clients. X caches card metadata independently from the app deployment, so changed previews may take time to appear.

## Voting

When voting is enabled and Keychain is available, enter your public Hive username and choose **Upvote 100%**. The card calls the [Keychain vote API](https://github.com/hive-keychain/hive-keychain-extension/blob/master/documentation/README.md#requestvote) and displays success only after the wallet confirms. If Keychain is unavailable, choose **Open on Skatehive** to vote on the full page. X's sandbox and mobile clients may not expose the extension or wallet bridge. Never place private Hive keys or signing credentials in card metadata or URLs. Keep the post page as the fallback when Keychain is unavailable.

## Implementation

- Route and metadata: `app/embed/[author]/[permlink]/page.tsx`
- Post content is fetched through `getPostContent` from the Hive server client.
- No X posting API credentials are needed; share the public embed URL in an ordinary X post.

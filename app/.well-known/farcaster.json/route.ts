export async function GET() {
  const appUrl =
    process.env.NEXT_PUBLIC_NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://skatehive.app';

  const config = {
    accountAssociation: {
      header: "eyJmaWQiOjIwNzIxLCJ0eXBlIjoiYXV0aCIsImtleSI6IjB4MmQxODgyMzA0YzlBNkZhN0Y5ODdDMUI0MWM5ZkQ1RThDRjA1MTZlMiJ9",
      payload: "eyJkb21haW4iOiJza2F0ZWhpdmUuYXBwIn0",
      signature: "Who5bMkXiJ0h5b9eE5R0+gipGNRkRh/szPmanokuuwIeIhMer5QFkuhEvNWRfvGOf5gPn5vMzTUtfy7lGMrm9Rw="
    },
    frame: {
      version: '1',
      name: 'SkateHive 3.0',
      buttonTitle: 'Open post',
      homeUrl: appUrl,
      imageUrl: `${appUrl}/opengraph-image.png`,
      webhookUrl: `${appUrl}/api/webhook`,
      iconUrl: `https://ipfs.skatehive.app/ipfs/QmXTZqirogp735AaPFcpzAjmwS57mPYsJhktJMuRuSV5Rm`,
      splashImageUrl: `https://ipfs.skatehive.app/ipfs/QmXTZqirogp735AaPFcpzAjmwS57mPYsJhktJMuRuSV5Rm`,
      splashBackgroundColor: '#000000',
      subtitle: 'Skateboarding Social Network',
      description: 'Connect with skaters worldwide, share your tricks, and build the skateboarding community on Web3',
      screenshotUrls: [
        `${appUrl}/screenshots/home.png`,
        `${appUrl}/screenshots/feed.png`,
        `${appUrl}/screenshots/profile.png`
      ],
      primaryCategory: 'social',
      tags: ['skateboarding', 'social', 'web3', 'community', 'dao'],
      heroImageUrl: `${appUrl}/opengraph-image.png`, // TODO: Create custom hero image (1200x630px)
      tagline: 'Skateboarding meets Web3',
      ogTitle: 'SkateHive Web3 Skateboarding',
      ogDescription: 'Join the global skateboarding community on Web3. Share tricks and earn rewards.',
      ogImageUrl: `${appUrl}/opengraph-image.png`,
      castShareUrl: `${appUrl}/share`
    },
  };

  return Response.json(config);
}
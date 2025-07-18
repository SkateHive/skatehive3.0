# Skatehive 3.0

Skatehive 3.0 is a Next.js application for the [Skatehive](https://www.skatehive.app) community. It lets users post content to the Hive blockchain, share skate spots, view community bounties and leaderboards and receive Farcaster notifications. The project uses Chakra UI for styling along with Tailwind utilities and integrates with Aioha, Whisk, Wagmi/Viem and React Query.

## Local Development

1. Copy `.env.local.example` to `.env.local` and fill in the values for your environment.
2. Install dependencies with [pnpm](https://pnpm.io):

```bash
pnpm install
```

3. Run the development server:

```bash
pnpm dev
```

Open `http://localhost:3000` in your browser.

Run `pnpm lint` to check lint rules and `pnpm build` to create a production build.

## Environment Variables

The app relies on a number of environment variables. The most common ones are provided in `.env.local.example`:

```bash
NEXT_PUBLIC_THEME=your_theme            # Available: bluesky, hacker, forest, nounish, etc.
NEXT_PUBLIC_HIVE_COMMUNITY_TAG=hive-xxxxx
NEXT_PUBLIC_HIVE_SEARCH_TAG=hive-xxxxx
NEXT_PUBLIC_HIVE_USER=skatedev
NEXT_PUBLIC_BASE_URL=http://localhost:3000
HIVE_POSTING_KEY=posting_key_here

# Optional Postgres database (used for Farcaster notifications)
POSTGRES_URL=
POSTGRES_PRISMA_URL=
POSTGRES_URL_NO_SSL=
POSTGRES_URL_NON_POOLING=
POSTGRES_USER=
POSTGRES_HOST=
POSTGRES_PASSWORD=
POSTGRES_DATABASE=

# Farcaster notification settings
FARCASTER_INIT_PASSWORD=your_secure_password_for_database_init

# Admin users for Farcaster notification system (comma-separated usernames)
ADMIN_USERS=user1,user2,user3
```

Additional variables used by specific features:

- `ADMIN_USERS` – comma-separated list of usernames with admin privileges for Farcaster notifications (e.g., `user1,user2,user3`)
- `PINATA_API_KEY` and `PINATA_SECRET_API_KEY` – upload media to Pinata/IPFS
- `GIPHY_API_KEY` – GIF search in the composer
- `NEXT_PUBLIC_WHISK_API_KEY` – Whisk social identity resolution
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_COMMUNITY`, `EMAIL_RECOVERYACC` – sending invite emails
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`, `SUPABASE_PRIVATE_KEY` – Supabase integration
- Ethereum/Wagmi keys such as `NEXT_PUBLIC_WC_PROJECT_ID`, `ETHERSCAN_API_KEY`, `NEXT_PUBLIC_ALCHEMY_KEY` and DAO addresses (`NEXT_PUBLIC_TOKEN`, `NEXT_PUBLIC_METADATA`, `NEXT_PUBLIC_AUCTION`, `NEXT_PUBLIC_TREASURY`, `NEXT_PUBLIC_GOVERNOR`)
- `FARCASTER_HUB_URL` – custom Farcaster hub (optional)

## Application Features

- **Compose posts** with Markdown, images, videos or GIFs and publish them to the Hive blockchain.
- **Skate spots** map for sharing and discovering places to skate.
- **Bounties** for trick challenges with community rewards.
- **Leaderboard** ranking Hive users by community engagement.
- **Magazine/Blog** pages for curated articles and snaps.
- **Invite system** allowing users to create Hive accounts via email.
- **Farcaster notifications** that bridge Hive activity to Farcaster miniapp users. See [docs/SKATEHIVE_FARCASTER_NOTIFICATIONS.md](docs/SKATEHIVE_FARCASTER_NOTIFICATIONS.md) for implementation details.

## Deployment

The app is designed for [Vercel](https://vercel.com). After setting up the environment variables in your Vercel project, deploy with the standard Next.js build process.


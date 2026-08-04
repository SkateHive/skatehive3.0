<div align="center" >
  <img width="487" height="130" alt="Skatehive Logo" src="https://github.com/user-attachments/assets/a06eedb7-46bd-4d06-b050-c6a0fabc2084" />
</div>
<br/>

Skatehive 3.0 is a Next.js application for the [Skatehive](https://www.skatehive.app) community. It lets users post content to the Hive blockchain and interact with Farcaster and Ethereum protocols, share skate spots, view community bounties and leaderboards. The project uses Chakra UI for styling along with Tailwind utilities and integrates with Aioha, Wagmi/Viem and React Query.

<img width="1440" height="1045" alt="image" src="https://github.com/user-attachments/assets/8e195188-d2cb-4144-b1b5-9eb8adb6e749" />

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

## GitHub Codespaces

This repo contains a `.devcontainer` folder so you can work in
[GitHub Codespaces](https://github.com/features/codespaces). Launch a
new codespace from the **Code** menu on GitHub and the container will
install dependencies with `pnpm install` and forward port `3000` for the
Next.js dev server. The container installs Node.js 20 with pnpm 9 via the
official Node feature so the environment matches local development.
Once setup completes, run `pnpm dev` to launch the application.

## Environment Variables

The app uses a centralized configuration system where sensible defaults are stored in `config/app.config.ts` (committed to version control). Only secrets and deployment-specific overrides should live in `.env.local`.

### Minimal Setup

For a basic local installation, copy `.env.local.example` to `.env.local` and set only the Hive posting key:

```bash
HIVE_POSTING_KEY=your_hive_posting_key
```

All other values (Hive tags, app account, DAO addresses, etc.) are pre-configured in `config/app.config.ts`.
If you enable app-only posting (email-only users), also set:

```bash
DEFAULT_HIVE_POSTING_ACCOUNT=skateuser
DEFAULT_HIVE_POSTING_KEY=your_default_account_posting_key
```

Optional: receive webhook alerts when default-account broadcasts fail/retry:

```bash
USERBASE_ALERT_WEBHOOK_URL=https://your-webhook-endpoint
```

### Forking the Project

If you fork Skatehive for your own community, you can override default settings in `.env.local`:

```bash
# Override your community settings
NEXT_PUBLIC_BASE_URL=https://your-community.app
NEXT_PUBLIC_THEME=your_theme
```

Important: The core configuration (Hive tags, DAO contract addresses, app account) is defined in `config/app.config.ts`. To fully customize your fork, create your own config file with your values for:

- `HIVE_CONFIG.COMMUNITY_TAG` – your Hive community tag
- `HIVE_CONFIG.SEARCH_TAG` – your search tag
- `HIVE_CONFIG.APP_ACCOUNT` – your app's default Hive user
- `DAO_ADDRESSES` – your DAO contract addresses (if using DAO features)
- `APP_CONFIG.NAME`, `APP_CONFIG.DOMAIN` – your app branding

#### Database migrations (optional)

If you enable the userbase schema, run the SQL files under `sql/migrations/`.
For Supabase, run `0001_userbase.sql` first, then `0002_userbase_rls_supabase.sql` in the SQL editor.
If you enable magic-link auth, also run `0003_userbase_auth.sql`.
If you enable app-only posting, also run `0007_userbase_soft_posts.sql` and `0008_userbase_soft_posts_rls.sql`.
For self-hosted Postgres, run `0001_userbase.sql`, `0003_userbase_auth.sql`, and (if enabling app-only posting) `0007_userbase_soft_posts.sql` via `psql` using `DATABASE_URL`.
Migrations are currently manual; there is no automated runner in the repo yet.
If you skip Supabase RLS, keep the service role key server-only.
Userbase tables are prefixed with `userbase_` to avoid conflicts with the VIP signup schema.
### Optional Features

Add these variables to `.env.local` as needed:

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLIC_KEY`, `SUPABASE_SERVICE_ROLE_KEY` – Supabase integration
- `PINATA_JWT` – JWT token for Pinata/IPFS uploads (get from Pinata dashboard > API Keys)
- `GIPHY_API_KEY` – GIF search in the composer
- `EMAIL_USER`, `EMAIL_PASS`, `EMAIL_RECOVERYACC` – email settings for invites
- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`, `NEXT_PUBLIC_ALCHEMY_KEY`, `ETHERSCAN_API_KEY` – Web3 features
- `FARCASTER_HUB_URL`, `FARCASTER_INIT_PASSWORD` – Farcaster notifications
- `ADMIN_USERS` – comma-separated list of admin usernames
- `JWT_SECRET`, `VIP_PEPPER`, `SIGNER_URL`, `SIGNER_TOKEN` – signup/signer system

## Translation guidelines for contributors

Skatehive is a multilingual application supporting English, Portuguese (Brazil), Spanish, and Luganda. All human-facing text must be translation-compatible.

### How to add translatable strings

When adding new features, always use the translation system instead of hardcoding strings:

1. **Use the `useTranslations` hook** in client components:
   ```typescript
   import { useTranslations } from '@/lib/i18n/hooks';
   
   export function MyComponent() {
     const t = useTranslations('feature');
     return <button>{t('actionLabel')}</button>;
   }
   ```

2. **Add keys to ALL language files** simultaneously (`lib/i18n/locales/en.ts`, `pt-BR.ts`, `es.ts`, `lg.ts`):
   ```typescript
   feature: {
     actionLabel: 'Your text here',
   }
   ```

3. **Never hardcode strings**. Always prefer translations over direct text.

### Translation files and structure

- `lib/i18n/locales/en.ts` – English (base language)
- `lib/i18n/locales/pt-BR.ts` – Portuguese (Brazil)
- `lib/i18n/locales/es.ts` – Spanish
- `lib/i18n/locales/lg.ts` – Luganda
- `lib/i18n/hooks.ts` – `useTranslations(namespace)` hook for client components
- `lib/i18n/translations.ts` – Central export point for all translations

For more details on the translation system, see `AGENTS.md` → "Translation system" section.

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

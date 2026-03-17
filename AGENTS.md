# Agent Guidelines

This repository contains the **Skatehive 3.0** web application. It is a Next.js based community site for the Skatehive (Hive blockchain) community.

## Technology overview

- **Node.js** 20.x
- **Package manager:** pnpm 9.x (lockfile version 9). Always use `pnpm` for installs and scripts.
- **Next.js** 15.3.2
- **Chakra UI** 2.10.9 (icons 2.2.4)
- **Tailwind CSS** 4
- **React Query** for data caching
- **Wagmi** and **Viem** for Ethereum connectivity
- **Aioha** for Hive authentication and wallet support
- TypeScript is enabled via `tsconfig.json`.
- The project deploys on **Vercel** using the default Next.js build.

## Local setup

1. Copy `.env.local.example` to `.env.local` and update values.
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Start the dev server:
   ```bash
   pnpm dev
   ```
4. Run lint checks with `pnpm lint`.

## Providers and dependencies

The main provider tree is defined in `app/providers.tsx`.
Key packages and their roles:

- **Aioha** – registers Hive auth options and manages wallets
- **Chakra UI** – theme and global styles through `ThemeProvider`
- **React Query** – data caching via `QueryClientProvider`
- **Wagmi** with **Viem** – Ethereum RPC connectivity
- **UserProvider** – stores Hive user information

Keep provider logic modular. New providers should live in their own modules under `app/` or `contexts/`.

When adding a dependency, verify the package and maintainer to avoid typosquatted packages. Check with `pnpm info <pkg>` and inspect its repository. Run `pnpm audit` after install and review subdependencies using `pnpm list <pkg>`.

For coding rules, file structure, and patterns, see `RULES.md`.

## Code style guidelines

### React/JSX best practices

**CRITICAL - Apostrophes in JSX:**
- **NEVER use apostrophes (`'`) in JSX text content** - this causes `react/no-unescaped-entities` linting errors
- Instead, reword to avoid contractions or use HTML entities (`&apos;`)
- This is a very common and recurring mistake that breaks builds

**Examples:**

❌ **WRONG:**
```jsx
<Text>User's profile</Text>
<Alert>They'll receive an email</Alert>
<Text>Don't use apostrophes</Text>
```

✅ **CORRECT:**
```jsx
<Text>User profile</Text>
<Alert>An email will be sent</Alert>
<Text>Do not use apostrophes</Text>
```

**Other JSX escape rules:**
- Use `&quot;` for quotes in text content
- Use `&amp;` for ampersands in text content
- Use `&lt;` and `&gt;` for angle brackets in text content

## Theme strategy

The application uses a centralized theming system via Chakra UI with multiple pre-defined themes.

### Theme structure

- **Theme files:** All themes are located in `/themes/` directory
- **Theme provider:** The `ThemeProvider` in `app/themeProvider.tsx` manages theme state
- **Available themes:** 18+ themes including `hackerPlus` (default), `forest`, `bluesky`, `cyberpunk`, `nounish`, `windows95`, `gruvbox-nogg`, etc.

### Theme requirements

Each theme file must export a Chakra UI theme object using `extendTheme()` with these **required color tokens:**

```typescript
colors: {
  background: string,      // Main background color
  text: string,            // Primary text color
  primary: string,         // Primary brand color
  secondary: string,       // Secondary brand color
  accent: string,          // Accent/highlight color
  muted: string,           // Muted background
  border: string,          // Border color
  error: string,           // Error state
  success: string,         // Success state
  warning: string,         // Warning state
  panel: string,           // Panel background
  panelHover: string,      // Panel hover state
  inputBg: string,         // Input background
  inputBorder: string,     // Input border
  inputText: string,       // Input text
  inputPlaceholder: string,// Input placeholder
  dim: string,             // Dimmed text
  subtle: string,          // Subtle backgrounds (usually rgba)
}
```

Themes may also define:
- `fonts` – heading, body, mono font families
- `fontSizes`, `fontWeights`, `lineHeights`
- `borders`, `shadows`, `radii`
- `components` – Chakra component style overrides (Button, Input, Card, etc.)

### Using themes in components

**DO:**
- Use semantic color tokens: `bg="background"`, `color="primary"`, `borderColor="border"`
- Use Chakra props: `<Box bg="panel" borderColor="border" />`
- Access theme via `useTheme()` hook when needed
- Test components with multiple themes

**DON'T:**
- Hard-code hex colors or specific color values
- Use color values that aren't defined in the theme
- Assume a specific color scheme (dark/light)

### Adding a new theme

1. Create a new file in `/themes/yourtheme.ts`
2. Use `extendTheme()` and include all required color tokens
3. Import and register in `app/themeProvider.tsx`:
   - Import: `import yourTheme from "@/themes/yourtheme"`
   - Add to `themeMap`: `yourtheme: yourTheme`
4. Export from `/themes/index.ts`

### Theme switching

Users can switch themes at runtime. The selected theme is persisted in `localStorage`. The fallback theme is `hackerPlus`. Theme can be overridden via `APP_CONFIG.THEME_OVERRIDE` or `APP_CONFIG.DEFAULT_THEME`.

## Translation system

Skatehive supports multiple languages: English, Portuguese (Brazil), Spanish, and Luganda. All human-facing strings must be translation-compatible to maintain consistency across languages.

### Translation architecture

- **Translation files:** Located in `lib/i18n/locales/` with separate files for each language (`en.ts`, `pt-BR.ts`, `es.ts`, `lg.ts`)
- **Translation hook:** Use `useTranslations(namespace)` from `@/lib/i18n/hooks` in client components
- **Centralized exports:** All translations registered in `lib/i18n/translations.ts`
- **Context provider:** `LocaleContext` in `contexts/LocaleContext.tsx` manages language state

### Writing translation-compatible code

**DO:**
- Use the `useTranslations` hook for all user-facing strings in client components
- Organize strings by namespace (e.g., `notifications`, `auction`, `chat`)
- Add new translation keys to ALL language files (`en.ts`, `pt-BR.ts`, `es.ts`, `lg.ts`) simultaneously
- Store static strings in translation files, not hardcoded in components

**Example:**
```typescript
'use client';

import { useTranslations } from '@/lib/i18n/hooks';

export function MyComponent() {
  const t = useTranslations('myfeature');
  
  return (
    <div>
      <h1>{t('title')}</h1>
      <p>{t('description')}</p>
    </div>
  );
}
```

Then in translation files:
```typescript
// lib/i18n/locales/en.ts
myfeature: {
  title: 'My Feature Title',
  description: 'Feature description text',
}
```

**DON'T:**
- Hard-code user-facing strings directly in components
- Add strings to only one or two language files
- Use string concatenation for translatable content
- Store UI text in component files instead of translation files

### Adding a new translation namespace

1. Create the namespace in ALL language files (`en.ts`, `pt-BR.ts`, `es.ts`, `lg.ts`)
2. Import and export the namespace in `lib/i18n/translations.ts`
3. Use `useTranslations('namespaceName')` in components
4. Run `pnpm lint` to verify the setup

### Current supported languages

- **en** – English (🇺🇸)
- **pt-BR** – Portuguese (Brazil) (🇧🇷)
- **es** – Spanish (🇪🇸)
- **lg** – Luganda (🇺🇬)

## Userbase system

The userbase system enables "lite" users (email-only or wallet-only accounts) to participate without Hive blockchain keys. These users post through a shared default Hive account with their identity preserved via an overlay system.

### Core concepts

- **Lite users** – Users authenticated via email magic link or Ethereum wallet, without Hive keys
- **Soft posts** – Posts published under a default Hive account (`skateuser`) but attributed to a userbase user
- **Safe user** – HMAC hash of `user_id` stored in post metadata for secure identity lookup
- **Overlay system** – React hooks that fetch userbase profiles to display instead of "skateuser"

### Key files

| File | Purpose |
|------|---------|
| `hooks/useSoftPostOverlay.ts` | Hook for fetching/caching soft post overlays |
| `lib/userbase/safeUserMetadata.ts` | Extracts safe_user hash from post metadata |
| `app/api/userbase/soft-posts/route.ts` | API for fetching overlay data |
| `contexts/UserbaseAuthContext.tsx` | Userbase authentication state |

### Database tables

All userbase tables are prefixed with `userbase_` and defined in `sql/migrations/`:

- `userbase_users` – User profiles (display_name, handle, avatar_url)
- `userbase_identities` – Linked identities (email, wallet, Hive account)
- `userbase_soft_posts` – Registry of posts made through the default account
- `userbase_soft_votes` – Registry of votes made through the default account

### Using the overlay hook

```typescript
import useSoftPostOverlay from "@/hooks/useSoftPostOverlay";
import { extractSafeUser } from "@/lib/userbase/safeUserMetadata";

function PostItem({ discussion }) {
  const safeUser = extractSafeUser(discussion.json_metadata);
  const softPost = useSoftPostOverlay(discussion.author, discussion.permlink, safeUser);
  
  const displayAuthor = softPost?.user.display_name || discussion.author;
  const displayAvatar = softPost?.user.avatar_url || defaultAvatar;
}
```

For detailed documentation, see `docs/USERBASE_SOFT_POSTS.md`.

## Feed mini-app embeds

The feed supports inline "mini-app" cards for special URLs. When a user posts a link to a supported platform, it renders as a rich interactive card instead of a plain link.

### Supported embeds

| Platform | URL Pattern | Component | Features |
|----------|-------------|-----------|----------|
| Zora Coins | `zora.co/.../coin/...` | `ZoraCoinEmbed` | Coin price, market cap, CTA |
| Builder DAO | `nouns.build/.../vote/...` | `BuilderProposalPreview` | Proposal status, vote counts |
| Snapshot | `snapshot.box/#/...` | `SnapshotProposalPreview` | Vote status, choices |
| POIDH Bounties | `skatehive.app/bounties/poidh/...` | `BountyPreview` | Reward in ETH+USD, claim modal |

### 5-layer embed architecture

Adding a new embed type follows this pipeline:

1. **URL detection** (`lib/markdown/MarkdownProcessor.ts`) — Regex matches URLs and converts to placeholders like `[[TYPE:data]]`
2. **Placeholder extraction** (`extractVideoPlaceholders`) — Split regex updated to recognize new type
3. **Renderer split** (`components/markdown/EnhancedMarkdownRenderer.tsx`) — Splits content on placeholder boundaries
4. **Placeholder handler** — Maps placeholder type to the correct React component
5. **Embed component** — Self-contained component that fetches its own data and renders the card

### Adding a new embed

1. Add URL regex + placeholder conversion in `MarkdownProcessor.ts` (follow the `convertPoidhBountyLinksToPlaceholders` pattern)
2. Add the new type to the `VideoPlaceholder` type union
3. Update `extractVideoPlaceholders` regex to include new type
4. In `EnhancedMarkdownRenderer.tsx`:
   - Add new type to the split regex
   - Add handler in the placeholder matching section
   - Add cleanup regex to strip raw URLs that were already converted
5. Create the embed component (fetch data via React Query, render card)

### BountyPreview mini-app

`components/bounties/BountyPreview.tsx` is a full-featured embed:
- Fetches bounty data from `/api/poidh/bounties/[chainId]/[id]`
- Fetches ETH price (shared `queryKey: ["eth-price"]` across instances)
- Shows reward as "Win X ETH ~ ($Y USD)"
- Displays bounty image if available (natural aspect ratio)
- Inline CLAIM modal with full upload flow (IPFS upload, description, title)
- Cross-posts claims to Hive if user has Hive identity
- Entire card is clickable NextLink to bounty detail page

## Hive cross-posting pattern

When a feature needs to cross-post content to Hive, use the dual-path approach:

```typescript
// Path 1: User has Keychain (aioha)
if (aiohaUser) {
  await aioha.comment(
    null, HIVE_CONFIG.COMMUNITY_TAG, permlink, title, body,
    { tags: [...], app: "Skatehive App 3.0", image: [...] }
  );
}
// Path 2: User has userbase identity (stored posting key)
else {
  await fetch("/api/userbase/hive/comment", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      parent_author: "", parent_permlink: HIVE_CONFIG.COMMUNITY_TAG,
      permlink, title, body,
      json_metadata: { tags: [...], app: "Skatehive App 3.0", image: [...] },
      beneficiaries: [], type: "post",
    }),
  });
}
```

Key hooks for detecting Hive identity:
- `useHiveUser()` from `contexts/UserContext` — Keychain users
- `useUserbaseHiveIdentity()` from `hooks/useUserbaseHiveIdentity` — Userbase users with linked Hive
- `useAioha()` from `@aioha/react-ui` — Aioha wallet instance

Use `generatePermlink()` and `generateVideoIframeMarkdown()` from `lib/markdown/composeUtils.ts`.

## Market prices

`hooks/useMarketPrices.ts` provides centralized price data:
- Fetches HIVE, HBD, and ETH prices from CoinGecko
- Auto-refreshes every 5 minutes
- Fallback prices: HIVE=$0.21, HBD=$1.00, ETH=$2500
- Used by bounty sorting, USD conversions, and feed embeds

For ETH-only price needs, use a shared React Query key:
```typescript
const { data: ethPrice } = useQuery<number>({
  queryKey: ["eth-price"],
  queryFn: async () => { /* fetch from CoinGecko */ },
  staleTime: 5 * 60 * 1000,
});
```

## IPFS uploads

`lib/utils/ipfsUpload.ts` provides `uploadToIpfsSmart()`:
- Unified upload function for images and videos
- Auto-routes files >4MB directly to Pinata for reliability
- Returns `{ url, cid }` on success
- Used by post composer, bounty claims, and profile uploads

## Key component patterns

### SkateModal
`components/shared/SkateModal.tsx` — Standard modal wrapper used across the app.
Props: `isOpen`, `onClose`, `title`, `children`, `size` (default `"md"`)

### CommunityTotalPayout
`components/shared/CommunityTotalPayout.tsx` — Sidebar widget that:
- Shows total HBD community payout (from HiveHub stats API)
- Alternates with total open bounties USD value every 4 seconds
- Scramble animation on transitions
- Click navigates to `/bounties` when showing bounty total, opens magazine modal otherwise

## Homepage loading architecture

The homepage loading chain is sequential:
```
UserbaseAuthProvider → useUserbaseHiveIdentity → useHiveAccount → VoteWeightProvider
```

Known optimization opportunities:
1. **Feed source**: PROD uses 6-9 sequential Hive RPCs; DEV uses a single API call. Consider using API as primary.
2. **Duplicate identity fetches**: Both `useUserbaseHiveIdentity` and `LinkedIdentityProvider` fetch `/api/userbase/identities` independently.
3. **Leaderboard**: Fetched eagerly but only shown in AirdropModal — could be lazy-loaded.
4. **Identity caching**: Use `stale-while-revalidate` pattern for identity fetches.
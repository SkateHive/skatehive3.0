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
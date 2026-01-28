# Gemini Agent Guidelines for Skatehive 3.0

This document provides a comprehensive guide for AI agents and developers working on the Skatehive 3.0 repository. Adhering to these guidelines is crucial for maintaining code quality, consistency, and project velocity.

## 1. Project Overview

Skatehive 3.0 is a Next.js application for the [Skatehive](https://www.skatehive.app) community on the Hive blockchain. It integrates with Farcaster and Ethereum, and features include content posting, a skate spot map, bounties, and leaderboards.

- **Primary Goal:** Assist in developing and maintaining the Skatehive 3.0 application.
- **Key Interaction:** Read and understand this document, `RULES.md`, and `AGENTS.md` to inform all actions.

## 2. Technology & Setup

### Tech Stack
- **Framework:** Next.js 15.3.2
- **Language:** TypeScript
- **Package Manager:** pnpm 9.x (`pnpm install`, `pnpm dev`, `pnpm lint`, `pnpm build`)
- **UI:** Chakra UI 2.10.9 (primary), Tailwind CSS 4 (utilities)
- **Data Fetching:** React Query
- **Blockchain:**
  - **Hive:** Aioha (auth/wallet)
  - **Ethereum:** Wagmi, Viem
- **Deployment:** Vercel

### Local Development Setup

1.  **Environment:** Copy `.env.local.example` to `.env.local`. For a minimal setup, you only need to set `HIVE_POSTING_KEY`. Other defaults are in `config/app.config.ts`.
2.  **Dependencies:** Run `pnpm install`.
3.  **Run Dev Server:** Run `pnpm dev`. The app will be available at `http://localhost:3000`.

### GitHub Codespaces
This repository is configured for GitHub Codespaces. Launch a new codespace from the "Code" menu. The container will automatically install dependencies. Run `pnpm dev` to start the application.

### Database Migrations
Userbase features require manual database migrations located in `sql/migrations/`.
- **Supabase:** Run `0001_userbase.sql`, then `0002_userbase_rls_supabase.sql`.
- **Self-hosted Postgres:** Run `0001_userbase.sql`.
- Follow the sequence in `README.md` to enable features like magic-link auth and app-only posting.

## 3. Coding Rules & Conventions

### General
- **Language:** Use TypeScript for all new code.
- **Formatting:** Indent with **2 spaces**. Keep line length around 100 characters.
- **Imports:** Order imports: external modules first, then internal project paths.
- **Validation:** Always run `pnpm lint` and `pnpm build` before committing.

### File Structure
- **Pages & Layouts:** `app/<segment>/page.tsx` and `app/<segment>/layout.tsx`.
- **Components:**
  - Feature-specific: `components/<feature>/`
  - Shared: `components/shared/`
- **Hooks:** `hooks/`, prefixed with `use`.
- **Contexts:** `contexts/`.
- **Utilities:** `lib/utils/`.
- **Types:** `types/`.

### AI Agent-Specific Instructions
- **Follow All Rules:** Adhere strictly to all guidelines in this document.
- **Single-Responsibility Commits:** Group related changes into a single, clear commit.
- **No Hardcoded Colors:** **Crucial.** Never hardcode color values. Always use Chakra UI theme tokens.
- **Verify Dependencies:** Use `pnpm info <pkg>` and `pnpm audit` before adding new dependencies.

## 4. Styling: Chakra UI First

- **Primary System:** **Chakra UI is the source of truth for all styling.** Use Chakra components (`Box`, `Flex`, `Text`, etc.) and their style props (`bg`, `color`, `p`, `m`).
- **No Hardcoded Colors:** All colors must come from the theme. Use semantic tokens like `background`, `primary`, `border`.
  - **Correct:** `<Box bg="panel" color="text">`
  - **Incorrect:** `<div style={{backgroundColor: '#FFF'}}>` or `<Box color="white">`
- **Tailwind CSS:** Use only for simple utilities not covered by Chakra's props.
- **Custom CSS:** Avoid custom CSS files (`*.css`). Use `app/globals.css` only for third-party library overrides or global resets that are impossible to handle otherwise.

## 5. Theming System

The app has a multi-theme system managed by `ThemeProvider`. Themes are in `/themes/`.

### Theme Requirements
Every theme file in `/themes/` must export a Chakra theme object with a specific set of required color tokens (e.g., `background`, `text`, `primary`, `panel`, `border`, etc.). See `AGENTS.md` for the full list.

### Using Themes in Components
- **DO:** Use semantic tokens: `bg="background"`, `color="primary"`.
- **DON'T:** Hard-code hex values or assume a light/dark mode.

## 6. Translation (i18n)

All user-facing strings **must** be added to the translation system to support multiple languages.

### Implementation
1.  **Use the Hook:** In client components, use `const t = useTranslations('namespace');`.
2.  **Add Keys to All Files:** When adding a new string, add the key and translation to **all** language files simultaneously:
    - `lib/i18n/locales/en.ts`
    - `lib/i18n/locales/pt-BR.ts`
    - `lib/i18n/locales/es.ts`
    - `lib/i18n/locales/lg.ts`
3.  **No Hardcoded Strings:** Never write user-facing text directly in a component.

## 7. Userbase System (Lite Accounts)

This system allows users without Hive accounts (e.g., email-only) to post and vote. Content is published under a default Hive account (`skateuser`), and an overlay system attributes it back to the "lite" user.

- **Key Hook:** `useSoftPostOverlay` fetches and displays the correct user profile (e.g., email user's name) instead of the default account's.
- **Key Logic:** `extractSafeUser` from `lib/userbase/safeUserMetadata.ts` reads the user hash from post metadata.
- **API Endpoint:** `app/api/userbase/soft-posts/route.ts` serves the overlay data.

When working with posts or user profiles, always check if the `useSoftPostOverlay` hook should be used to display the correct author information. See `docs/USERBASE_SOFT_POSTS.md` for more details.
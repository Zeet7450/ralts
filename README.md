# Ralts — Personal Command Center

Ralts is a calm, minimalist PWA that combines finance tracking, task management, idea capture, and weekly/monthly reflection into one private, personal dashboard. Built for daily use on mobile and desktop.

## Tech Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Database & Auth**: Supabase
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **i18n**: next-intl
- **PWA**: @ducanh2912/next-pwa
- **State**: Zustand (with persist middleware for theme/locale)

## Features

- **Finance** — transaction logging, monthly budgets, savings goals
- **Ideas** — capture and track ideas with status (active / in-progress / completed)
- **Tasks** — daily task management with due dates and checklists
- **Reflection** — weekly and monthly journaling prompts
- **Settings** — theme (dark/light), language, notifications, sign-out
- **PWA** — installable on Android and desktop; works offline
- **Auth** — magic link email login, session persists across re-opens

## Getting Started

### 1. Install dependencies

```bash
pnpm install
```

### 2. Set up environment variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Required variables:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `ALLOWED_EMAIL` | Email address authorized to access the app |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only, for `/api/seed`) |
| `DEV_SECRET_KEY` | Secret for authorizing the `/api/seed` endpoint |
| `DEMO_USER_ID` | UUID of your demo user |
| `DEMO_EMAIL` | Your authorized email (same as `ALLOWED_EMAIL`) |

> **Important**: `.env.local` contains real secrets and is gitignored. Never commit it.

### 3. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

### 4. Seed demo data (optional)

With `DEMO_MODE=true` and a valid `DEV_SECRET_KEY`:

```bash
curl -X POST http://localhost:3000/api/seed \
  -H "x-dev-secret: your-dev-secret-key"
```

Or visit `/seed` in your browser — it will auto-seed and redirect to login.

## Environment Variables

| Variable | Public | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (safe to expose) |
| `ALLOWED_EMAIL` | No | Email allowlist for login |
| `DEMO_MODE` | No | Enable demo seeding route |
| `DEMO_USER_ID` | No | UUID for demo user |
| `DEMO_EMAIL` | No | Demo user email |
| `DEV_SECRET_KEY` | No | Secret for `/api/seed` |
| `SUPABASE_SERVICE_ROLE_KEY` | No | Server-side admin key (never expose) |

## Deploying to Vercel

1. Push your code to GitHub.
2. Import the project in Vercel.
3. In Vercel project settings → Environment Variables, add all the variables from `.env.example` with your real values.
4. Deploy.

The app assumes `NEXT_PUBLIC_*` variables are publicly safe. Real secrets (`SUPABASE_SERVICE_ROLE_KEY`, `DEV_SECRET_KEY`) should only be in server-side environment.

## Project Structure

```
src/
├── app/               # Next.js App Router pages
│   ├── (app)/        # Protected routes (dashboard, finance, tasks, etc.)
│   ├── api/          # API routes (auth/check, seed)
│   └── auth/         # Public auth routes (login, callback)
├── components/
│   ├── layout/       # AppShell, Sidebar, TopBar, MobileNav
│   ├── providers/     # ThemeProvider, IntlProvider
│   └── ui/           # Reusable UI primitives (Button, Input, Card, etc.)
├── lib/
│   ├── supabase/     # Browser and server Supabase clients
│   └── i18n/         # Internationalization setup
├── stores/           # Zustand stores (auth, theme, locale, finance, etc.)
└── types/            # TypeScript type definitions
```

## PWA

The app is PWA-first. On first visit, browsers will prompt to install. The service worker caches static assets and API responses for offline use.

To update the PWA after deploying, a new build is required (`pnpm build`).

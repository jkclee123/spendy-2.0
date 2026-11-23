# Spendy - Agent Development Guide

## Folder Structure

```
spendy/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (authenticated)/    # Protected routes (transactions, charts, categories, settings)
│   │   ├── api/                # API routes (NextAuth, transactions endpoint)
│   │   ├── login/              # Login page
│   │   ├── globals.css         # Global styles
│   │   ├── layout.tsx          # Root layout with providers
│   │   └── page.tsx            # Landing page
│   ├── components/
│   │   ├── ui/                 # Generic reusable UI components
│   │   ├── charts/             # Chart components
│   │   ├── transactions/       # Transaction-related components
│   │   ├── settings/           # Settings page components
│   │   ├── navigation/         # Navigation components
│   │   └── layout/             # Layout components
│   ├── lib/                    # Utilities, providers, auth config
│   │   ├── auth.ts             # NextAuth configuration
│   │   ├── convex.tsx          # Convex provider setup
│   │   ├── providers.tsx       # Combined providers
│   │   └── LanguageProvider.tsx
│   ├── hooks/                  # Custom React hooks
│   ├── types/                  # Shared TypeScript types
│   └── i18n.ts                 # i18n configuration
├── convex/                     # Convex backend
│   ├── schema.ts               # Database schema
│   ├── transactions.ts         # Transaction mutations/queries
│   ├── users.ts                # User management
│   ├── userCategories.ts       # Category management
│   ├── aggregates.ts           # Aggregation functions
│   ├── http.ts                 # HTTP actions
│   └── crons.ts                # Scheduled jobs
├── messages/                   # i18n translation files (en.json, zh-HK.json)
├── tests/
│   ├── unit/                   # Unit tests
│   ├── integration/            # Integration tests
│   └── contract/               # API contract tests
└── public/                     # Static assets & PWA files
```

## Bun Commands

```bash
# Development
bun run dev              # Start Next.js dev server (localhost:3000)
bunx convex dev          # Start Convex backend (separate terminal)

# Build & Production
bun run build            # Production build
bun start                # Start production server

# Linting & Type Checking
bun run lint             # Run ESLint + TypeScript check (tsc --noEmit)

# Testing
bun run test                        # Run all tests
bun run test tests/unit/aggregates.test.ts     # Run single test file
bun run test tests/integration/cron.test.ts    # Run specific integration test
bun run test -- --grep "aggregat"              # Run tests matching pattern
bun run test:e2e                    # Run Playwright e2e tests

# Deployment
bunx convex deploy       # Deploy Convex backend
```

## Running a Single Test

```bash
bun run test <file-path>
bun run test tests/unit/category-ordering.test.ts
bun run test tests/contract/api-transactions-create.test.ts
```

## Spendy Cloud Edge Function

- Use `bash scripts/supabase-cloud.sh check` to verify production access without a macOS Keychain prompt.
- Only when asked to deploy, use `bash scripts/supabase-cloud.sh deploy` to deploy `create-transaction` to Spendy.
- For other hosted Spendy commands, keep the explicit project credential and `SUPABASE_NO_KEYRING=1`. Do not run `supabase login` or retry without the credential. If the credential is missing, expired, or gets `403`, direct the user to the [token setup guide](README.md#supabase-keychain-prompt-or-token-expiry).

## Cursor Rules

- TypeScript 5.x with strict mode
- Next.js App Router with Convex backend
- Tailwind CSS for styling
- next-auth (Google OAuth) for authentication
- recharts for data visualization
- next-intl for internationalization (English/Chinese)

## Code Style

- TypeScript strict mode enabled, no explicit `any`
- Path alias: `@/*` maps to `./src/*`
- Double quotes, 2-space indentation, trailing commas (ES5)
- ESLint: Next.js config + TypeScript rules
- Husky pre-commit hooks run lint-staged

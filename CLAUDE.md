# spendy-vite-supabase-migration Development Guidelines

Auto-generated from all feature plans. Last updated: 2026-03-04

## Active Technologies

- TypeScript 5.9+, React 19, Vite
- Supabase (PostgreSQL, Auth, Edge Functions, Storage)
- React Router v7, i18next, Tailwind CSS
- Recharts, Lucide React, date-fns
- Vitest (unit), Playwright (E2E)

## Project Structure

```text
src/              # React SPA source
supabase/         # Migrations + Edge Functions
messages/         # i18n JSON files (en, zh-HK)
specs/            # Feature specifications
```

## Commands

```bash
bun dev           # Start Vite dev server
bun build         # Production build
bun test          # Run Vitest
bun test:e2e      # Run Playwright
```

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling
- ESLint + Prettier
- Husky pre-commit hooks

## Recent Changes

- 005-vite-supabase-migration: Migrating from Next.js + Convex to React 19 + Vite + Supabase

<!-- MANUAL ADDITIONS START -->
<!-- MANUAL ADDITIONS END -->

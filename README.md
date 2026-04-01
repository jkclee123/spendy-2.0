# <img src="public/logo.png" alt="Spendy Logo" width="40" style="vertical-align: middle; margin-right: 10px;"> Spendy

A modern, multilingual transaction tracking application built with React 19, Vite, and Supabase. Track your expenses and income with a beautiful, responsive UI that works on desktop and mobile (PWA enabled).

## Features

- **Transaction Management**: Create, update, and delete expense/income records
- **Custom Categories**: Personalized emoji-based categories with multilingual support (English/Chinese)
- **Statistics Dashboard**: Visual analytics with charts showing spending patterns
- **Multi-language Support**: i18n with English and Chinese (Hong Kong) interfaces
- **Google OAuth**: Secure authentication via Supabase Auth
- **PWA Support**: Progressive Web App capabilities for mobile installation
- **External API**: Supabase Edge Function for third-party integrations (iOS Shortcuts support)
- **API Token Authentication**: Secure token-based access for external integrations
- **Dark Mode**: Automatic dark mode support via Tailwind CSS
- **Responsive Design**: Mobile-first design with Tailwind CSS

## Tech Stack

- **Framework**: [React 19](https://react.dev/) + [Vite](https://vitejs.dev/)
- **Language**: [TypeScript 5.9+](https://www.typescriptlang.org/) (Strict mode)
- **Backend**: [Supabase](https://supabase.com/) (PostgreSQL, Auth, Edge Functions, Storage)
- **Authentication**: Supabase Auth with Google OAuth
- **Routing**: [React Router v7](https://reactrouter.com/)
- **Styling**: [Tailwind CSS 3.4+](https://tailwindcss.com/)
- **Charts**: [Recharts](https://recharts.org/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **i18n**: [i18next](https://www.i18next.com/) + react-i18next
- **Testing**: [Vitest](https://vitest.dev/) (unit), [Playwright](https://playwright.dev/) (e2e)
- **PWA**: [vite-plugin-pwa](https://vite-pwa-org.netlify.app/)

## Quick Start

### Prerequisites

- [Bun](https://bun.sh/)
- [Supabase](https://supabase.com/) project
- [Supabase CLI](https://supabase.com/docs/guides/cli)
- Google OAuth credentials (via Supabase Auth dashboard)

### Setup

1. **Clone and install dependencies**:

   ```bash
   git clone <repository-url>
   cd spendy
   bun install
   ```

2. **Configure environment variables**:

   ```bash
   cp .env.example .env.local
   ```

   Edit `.env.local` with your Supabase project credentials:

   ```env
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=your-publishable-key
   ```

3. **Apply database migrations**:

   ```bash
   supabase db push
   ```

4. **Start the development server**:

   ```bash
   bun dev
   ```

Visit `http://localhost:5173` to see the application.

## Development

### Available Scripts

```bash
bun dev          # Start Vite development server
bun build        # Production build
bun preview      # Preview production build
bun lint         # Run ESLint + TypeScript checks
bun test         # Run Vitest unit tests
bun test:e2e     # Run Playwright e2e tests
```

### Project Structure

```
├── supabase/
│   ├── migrations/        # Database migrations (SQL)
│   └── functions/
│       └── create-transaction/  # Edge Function for external API
├── messages/              # i18n translation files
│   ├── en.json
│   └── zh-HK.json
├── public/                # Static assets & PWA files
└── src/
    ├── components/
    │   ├── charts/        # Recharts components
    │   ├── layout/        # Layout wrappers
    │   ├── navigation/    # Navigation bar
    │   ├── settings/      # Settings page components
    │   ├── transactions/  # Transaction form, list, filters
    │   └── ui/            # Generic UI components
    ├── hooks/             # Custom React hooks
    ├── i18n/              # i18next configuration
    ├── lib/               # Supabase client, auth, services
    ├── pages/             # Route-level page components
    └── types/             # Shared TypeScript types
```

### Code Style

- **TypeScript**: Strict mode enabled
- **ESLint**: TypeScript-aware rules
- **Prettier**: 2-space indentation, double quotes, trailing commas
- **Husky**: Pre-commit hooks run lint-staged automatically

### Database Schema

**users** (synced from Supabase Auth via trigger):

- `id`, `email`, `name`, `avatar_url`, `lang`, `api_token`, `created_at`

**user_categories**:

- `id`, `user_id`, `emoji`, `en_name`, `zh_name`, `is_active`, `order`, `created_at`

**transactions**:

- `id`, `user_id`, `name`, `category_id`, `amount`, `type` (`expense` | `income`), `created_at`

Row-level security (RLS) is enabled on all tables — users can only access their own data.

## API

### External API (Supabase Edge Function)

The app exposes a Supabase Edge Function for third-party integrations:

**POST** `/functions/v1/create-transaction`

```bash
curl -X POST https://your-project.supabase.co/functions/v1/create-transaction \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Coffee",
    "amount": 5.50,
    "category": "Restaurant"
  }'
```

**Request Body:**

| Field      | Type   | Required | Description                                |
| ---------- | ------ | -------- | ------------------------------------------ |
| `amount`   | number | Yes      | Transaction amount (must be > 0)           |
| `category` | string | Yes      | Category name (auto-created if not exists) |
| `name`     | string | No       | Optional transaction description           |

**Rate Limits:** 60 requests per minute per API token

### iOS Shortcuts Integration

The Settings page includes a downloadable iOS Shortcut for quick transaction entry from your mobile devices.

## Deployment

### Supabase

Deploy your database and Edge Functions:

```bash
supabase db push
supabase functions deploy create-transaction
```

### Vercel (Recommended)

1. Connect your GitHub repository to [Vercel](https://vercel.com/)
2. Set environment variables in the Vercel dashboard
3. Deploy with `git push`

### Environment Variables for Production

| Variable                        | Description                   |
| ------------------------------- | ----------------------------- |
| `VITE_SUPABASE_URL`             | Supabase project URL          |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon/publishable key |

## License

[MIT](LICENSE)

---

Built with React, Vite, Supabase, and love.

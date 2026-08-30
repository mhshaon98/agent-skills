# Notably

Notably turns long meeting notes into short summaries. Paste a note (or drop a
file), and Notably gives you a two-paragraph summary plus action items.

> **Fixture notice.** Notably is a fictional product used as a test fixture for
> the `/app-audit` skill. It is deliberately non-building: dependencies are never
> installed and the code is not expected to compile or run. Every key, price ID,
> and person named here is invented.

## Stack

- Next.js 14 (App Router) + TypeScript
- Supabase (Auth, Postgres, Storage)
- Stripe (Pro subscription, $12/mo)
- OpenAI (summarization)
- PostHog (product analytics)
- Vercel (hosting) + GitHub Actions (CI)

## Local development

```bash
cp .env.example .env.local   # fill in your own values
npm install
npm run dev
```

## Layout

```
app/            routes (marketing, dashboard, API)
components/     shared UI
lib/            supabase clients, stripe, openai, analytics
supabase/       migrations and storage bucket definitions
config/         legacy config leftovers (pending cleanup)
content/        changelog source text
```

## Deployment

Pushes to `main` deploy to Vercel. Database migrations are applied by hand with
`supabase db push` before the deploy.

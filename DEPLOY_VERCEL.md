# Deploying Rudra to Vercel

The project builds with TanStack Start + Nitro. Nitro auto-detects Vercel
(`VERCEL=1`) and emits a Build Output API v3 bundle at `.vercel/output/`, which
Vercel serves natively — no adapter or extra config needed.

## 1. Push the repo to GitHub / GitLab / Bitbucket

## 2. Import into Vercel

- New Project → Import your repo.
- **Framework Preset:** Other (leave as-is; `vercel.json` handles it).
- **Build Command:** `bun run build` (already set in `vercel.json`).
- **Install Command:** `bun install` (already set).
- **Output Directory:** `.vercel/output` (already set).

## 3. Environment variables

Add these in **Project Settings → Environment Variables** (Production + Preview):

Public (client + server):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PROJECT_ID`

Server-only secrets:
- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_SERVICE_ROLE_KEY` — service role key for the backend
- `PRINTIFY_API_KEY`
- `STRIPE_SECRET_KEY`

Copy the `VITE_*` values from `.env`. The service role, Printify, and Stripe
keys are the same ones already stored in Lovable Cloud secrets — paste them
into Vercel manually (Vercel and Lovable secret stores are independent).

## 4. Deploy

Click **Deploy**. Subsequent pushes to the main branch auto-deploy.

## Notes

- Server functions (`createServerFn`) and server routes run as Vercel
  serverless functions on Node — `process.env.*` works normally.
- The Stripe success URL is derived from the request host, so it works on
  both the `vercel.app` preview domain and any custom domain you attach.
- If you attach a custom domain, update the canonical / og:url values in
  `src/routes/__root.tsx` and route heads accordingly.

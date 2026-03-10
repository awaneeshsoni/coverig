# Coverig

SaaS for remixing short-form video templates. Create templates, upload assets, and let users remix them with custom text, videos, and styling.

## Tech Stack

- **Next.js 14** (App Router)
- **Supabase** (Auth, PostgreSQL, RLS)
- **Cloudflare R2** (Media storage)
- **Redis + BullMQ** (Render queue)
- **FFmpeg** (Video rendering)

## Setup

1. Clone and install:
   ```bash
   npm install
   ```

2. Copy env template and fill in your values:
   ```bash
   cp .env.example .env.local
   ```

3. Run Supabase migrations:
   ```bash
   # Apply migrations via Supabase dashboard SQL editor or CLI
   # Files: supabase/migration_*.sql
   ```

4. Start Redis (for queue):
   ```bash
   npm run redis   # or: docker run -p 6379:6379 redis:7-alpine
   ```

5. Run dev server and workers:
   ```bash
   npm run dev           # Next.js
   npm run worker:render # Video render worker
   npm run worker:schedule # Post scheduling worker
   ```

## Deploy

- **Vercel** (recommended): Push to GitHub, connect repo, add env vars. Use Vercel's Redis or **Upstash** for the queue.
- **Worker**: Deploy the worker as a separate process (e.g. Railway, Render, Fly.io) or use Vercel's background functions.
- See [DEPLOY.md](./DEPLOY.md) for free-tier deployment options.

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build |
| `npm run worker:render` | Video render worker |
| `npm run worker:schedule` | Post scheduling worker |
| `npm run redis` | Start Redis via Docker |

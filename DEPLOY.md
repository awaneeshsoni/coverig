# Deploy Coverig

## Your Stack (coverig.vercel.app)

| Service | Use |
|---------|-----|
| **Vercel** | Next.js app |
| **Supabase** | Auth + PostgreSQL |
| **Cloudflare R2** | Media storage |
| **Upstash Redis** | BullMQ queue |
| **Railway/Render** | Render + Schedule workers |

---

## Step 1: Vercel (App)

1. Push to GitHub and connect repo to Vercel
2. Add all env vars from `.env.example` in **Project Settings → Environment Variables**
3. Critical for Instagram:
   - `META_APP_ID`
   - `META_APP_SECRET`
   - `META_REDIRECT_URI` = `https://coverig.vercel.app/api/auth/instagram/callback` (or your Vercel URL)
   - `NEXT_PUBLIC_APP_URL` = `https://coverig.vercel.app` (must match deployed URL)
4. Redeploy after adding/changing env vars

---

## Step 2: Supabase

1. Run all migrations in order (`migration_001` through `migration_009`)
2. Migration 009 adds `content_id` to `scheduled_posts` for content-specific scheduling
3. In Supabase Dashboard → SQL Editor, run:

```sql
-- Run migration_009_scheduled_posts_content.sql
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'scheduled_posts' AND column_name = 'content_id') THEN
    ALTER TABLE scheduled_posts ADD COLUMN content_id uuid REFERENCES content(id) ON DELETE SET NULL;
    CREATE INDEX idx_scheduled_posts_content_id ON scheduled_posts(content_id);
  END IF;
END $$;
```

---

## Step 3: Meta App (Instagram)

1. Go to [Meta for Developers](https://developers.facebook.com/)
2. Your app → **App Dashboard** → **Instagram** (add if needed)
3. **Use cases** → ensure:
   - Instagram Login
   - Instagram Graph API (with `instagram_manage_insights`)
4. **Settings → Basic** → Add **Valid OAuth Redirect URIs**:
   - `https://coverig.vercel.app/api/auth/instagram/callback`
5. If using Instagram for business, complete App Review for `instagram_manage_insights`

---

## Step 4: Workers (2 jobs, 2 Dockerfiles)

| Dockerfile | Worker | Purpose |
|------------|--------|---------|
| `Dockerfile.render` | Render | Video rendering (FFmpeg + R2) |
| `Dockerfile.schedule` | Schedule | Scheduled Instagram posts (every 60s) |

### Railway (two services)

**Service 1 – Render worker**
- Connect from GitHub
- **Dockerfile path:** `Dockerfile.render`
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_R2_*`, `REDIS_URL`

**Service 2 – Schedule worker**
- Connect from GitHub
- **Dockerfile path:** `Dockerfile.schedule`
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `REDIS_URL`, `META_APP_ID`, `META_APP_SECRET`

### Render (two background workers)

**Service 1 – Render worker**
- New **Background Worker**
- **Dockerfile path:** `Dockerfile.render`
- Same env vars as above

**Service 2 – Schedule worker**
- New **Background Worker**
- **Dockerfile path:** `Dockerfile.schedule`
- Env: Supabase, Redis, Meta

---

## Checklist

- [ ] Supabase migrations 001–009 applied
- [ ] `NEXT_PUBLIC_APP_URL` = your Vercel URL
- [ ] `META_REDIRECT_URI` = `https://<your-domain>/api/auth/instagram/callback`
- [ ] Meta app: redirect URI added, `instagram_manage_insights` approved
- [ ] R2 bucket: public or CORS configured for your domain
- [ ] Redis (Upstash) URL set in Vercel and both workers
- [ ] Render worker: FFmpeg available (Dockerfile or buildpack)
- [ ] Schedule worker: running and polling every 60s
- [ ] Both workers: `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `REDIS_URL`

---

## Quick Commands

```bash
# Local dev
npm run dev
npm run worker:render &
npm run worker:schedule &

# Build check
npm run build
```

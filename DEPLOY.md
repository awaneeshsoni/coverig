# Deploy Coverig (Almost Free for Test Users)

## Recommended Free-Tier Stack

| Service | Free Tier | Use |
|---------|-----------|-----|
| **Vercel** | Hobby plan | Next.js app hosting |
| **Supabase** | 500MB DB, 1GB storage | Auth + PostgreSQL |
| **Cloudflare R2** | 10GB storage, 10M reads/mo | Media storage |
| **Upstash Redis** | 10K commands/day | BullMQ queue |
| **Railway** or **Render** | Free/hobby tier | Worker (FFmpeg) |

## Option A: Vercel + Railway (Simplest)

1. **Vercel** (App)
   - Push to GitHub, connect [awaneeshsoni/coverig](https://github.com/awaneeshsoni/coverig)
   - Add all env vars from `.env.example`
   - Set `NEXT_PUBLIC_APP_URL` to your Vercel URL

2. **Upstash Redis**
   - Create free DB at [upstash.com](https://upstash.com)
   - Copy `REDIS_URL` into Vercel env

3. **Railway** (Worker)
   - Create project, add a service from GitHub
   - Use `workers/previewWorker.ts` – set start command: `npx tsx workers/previewWorker.ts`
   - Add env vars (Supabase, R2, Redis, etc.)
   - FFmpeg: Railway supports it; use `apt-get install ffmpeg` in a Dockerfile or use Railway’s Node buildpack with FFmpeg

4. **R2**
   - Enable public access for the bucket or use signed URLs
   - Set `CLOUDFLARE_R2_PUBLIC_URL` to the public base URL

## Option B: Vercel + Render (Free Worker)

1. App on Vercel (same as above)

2. Worker on Render
   - Create a Background Worker
   - Build: `npm install`
   - Start: `npx tsx workers/previewWorker.ts`
   - Add a `Dockerfile` if FFmpeg is needed:
     ```dockerfile
     FROM node:20
     RUN apt-get update && apt-get install -y ffmpeg
     WORKDIR /app
     COPY . .
     RUN npm install
     CMD ["npx", "tsx", "workers/previewWorker.ts"]
     ```

## Option C: All-in-One (Fly.io or Render)

Deploy app + worker as two services in one project. Slightly more setup but one platform.

## Checklist

- [ ] Supabase migrations applied
- [ ] R2 bucket public or CORS configured
- [ ] Redis (Upstash) URL set
- [ ] Worker has FFmpeg available
- [ ] All env vars set in hosting and worker

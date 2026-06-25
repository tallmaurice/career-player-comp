# Career Player Comp

A web app that reads your work history the way an NBA front office reads a prospect. Upload a resume or LinkedIn PDF (or paste your work history), answer 8 quick questions, and Claude returns a personalized scouting report: a real player comp, a coined archetype title, 2K-style badges, a grade card, and a sharp pull-quote you can screenshot and share. No account. Nothing stored.

## Stack (locked, do not deviate)

- **Next.js 15 (App Router) + TypeScript + React 19**
- **Plain CSS** design system in `app/globals.css` (pixel-specific; preserved verbatim from the design export — not Tailwind)
- **Fonts** via `next/font/google`: Barlow Condensed (display), Inter (body), JetBrains Mono (labels/stat line)
- **Anthropic** via `@anthropic-ai/sdk` in a server route only (API key never reaches the client). Engine locked on `system-prompt-v7.md`: best-of-3 generate + cold judge on accuracy + fun.
- **Card image** via `satori` + `@resvg/resvg-js` in a route handler (a simplified satori-compatible card variant; the on-screen card keeps the grain/tilt/noise)
- **Rate limit** via `@upstash/ratelimit` + `@upstash/redis` (per-IP limit + a global daily spend kill-switch)
- **Stripe tip** is a plain external Payment Link in env (no SDK)
- **PDF text extraction** is client-side via `pdfjs-dist`

## Run locally

```bash
npm install            # not run here (no network at scaffold time)
cp .env.example .env.local
# fill in ANTHROPIC_API_KEY + Upstash creds; NEXT_PUBLIC_STRIPE_TIP_URL is pre-filled
npm run dev            # http://localhost:3000
```

Scripts: `npm run dev`, `npm run build`, `npm run start`.

## Environment variables

See `.env.example`. The Anthropic key + Upstash creds are server-only. The tip
link and site URL are `NEXT_PUBLIC_` because they ship to the client (the tip is
a public payment URL the Results screen links to).

| Var | Scope | Purpose |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | server | Claude API. Never expose to the client. |
| `NEXT_PUBLIC_STRIPE_TIP_URL` | client | External Stripe Payment Link for the tip (public URL). |
| `UPSTASH_REDIS_REST_URL` | server | Upstash Redis (rate limit + spend cap). |
| `UPSTASH_REDIS_REST_TOKEN` | server | Upstash Redis token. |
| `NEXT_PUBLIC_SITE_URL` | client | OG/Twitter metadata + card watermark. No trailing slash. |

## Deploy (Vercel)

1. Push this repo to a **new standalone GitHub repo** (this app code lives in its own repo; planning/docs stay in `aios/projects/career-player-comp/`).
2. In Vercel: **New Project → Import** the GitHub repo (not an empty drag-in project). Framework preset auto-detects Next.js.
3. Add the env vars above in Project Settings → Environment Variables.
4. Add Upstash Redis via **Vercel Storage marketplace** (free tier auto-injects `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN`).
5. Set the domain to `careerplayercomp.com` (owned via Namecheap).

> Note: `@resvg/resvg-js` ships native binaries and is marked `serverExternalPackages` in `next.config.mjs` so it runs in the Node.js runtime on Vercel. Card-image route handlers must use `export const runtime = "nodejs"` (not edge).

## Layout

```
app/
  globals.css                design system (verbatim from export) + :root palette/font vars
  layout.tsx                 fonts via next/font, metadata (OG/Twitter)
  page.tsx                   flow controller: holds AppState, sequences the 6 screens,
                             calls /api/generate-comp, builds the /api/card share URL
  components/                the 6 presentational screens (Landing, CareerUpload,
                             QuizQuestion, OptionalText, ScoutingRoom, Results)
  api/
    generate-comp/route.ts   POST: best-of-3 generate + cold judge (Node runtime); returns { comp }
    card/route.tsx           GET ?data=<b64url comp>&format=feed|story: satori -> resvg PNG (Node runtime)
lib/
  types.ts                   LOCKED contract: Comp, QuizAnswers, AppState, screen props, QUESTIONS
  pdf.ts                     client-side PDF text extraction (pdfjs-dist)
  engine/                    self-contained v7 engine: system-prompt.ts, player-pool.json, index.ts
public/
  og-default.png             static generic OG card (to be added before launch)
```

All screens are presentational and code against `lib/types.ts`; `page.tsx` is the
only stateful component. Nothing is stored: the comp lives in memory and the
shareable card travels only as a base64url query param to `/api/card`.

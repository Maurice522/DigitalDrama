# Digital Drama Blog

An automated blog that pulls trending topics from RSS feeds every hour, filters
for "digital drama" relevance, rewrites each item with AI commentary/opinion,
and publishes it — fully free-tier hosted.

**Flow:** RSS sources → GitHub Actions (hourly cron) → filter → LLM rewrite →
MongoDB Atlas → Astro static build → `wrangler deploy` → live site.

**Deployment is split across two hosts, in two separate repos:**
- This repo (`site` + `automation`) → fully static, deployed on **Cloudflare Pages**.
- [`digitaldrama-tts-backend`](../digitaldrama-tts-backend) (sibling project,
  separate repo) → the one dynamic piece, live text-to-speech generation,
  deployed on **Netlify**. See that project's own README for details. The site
  calls it over CORS via the `PUBLIC_TTS_API_URL` env var (see `site/.env.example`).

## Structure

- [`/automation`](automation) — Node.js script that fetches feeds, filters,
  calls the LLM, and writes to MongoDB. See [`automation/src/index.js`](automation/src/index.js).
- [`/site`](site) — the Astro site, 100% static output. Pages query MongoDB at
  build time: [`src/pages/index.astro`](site/src/pages/index.astro),
  [`src/pages/blog/index.astro`](site/src/pages/blog/index.astro),
  [`src/pages/blog/[slug].astro`](site/src/pages/blog/[slug].astro). Audio
  playback calls out to the separate TTS backend rather than a local API route.
- [`/.github/workflows/hourly.yml`](.github/workflows/hourly.yml) — hourly cron
  (`0 * * * *`) plus manual `workflow_dispatch`.

## Setup

### 1. MongoDB Atlas

1. Create a free account at mongodb.com/atlas and build a free **M0 cluster**.
2. Create a database user (separate from your Atlas login).
3. Copy the `mongodb+srv://...` connection string. The database (`digitalDrama`)
   and `articles` collection are created automatically on first write.

### 2. LLM API key

This uses the Gemini API (`GEMINI_MODEL` is set to `gemini-2.5-flash` in
[`automation/src/llm.js`](automation/src/llm.js) — change it there if you want
a different model). Generate a key at aistudio.google.com.

### 3. Local env files

Copy the example env files and fill in real values (never commit the real
`.env`):

```bash
cp automation/.env.example automation/.env
cp site/.env.example site/.env
```

### 4. Install and test locally

```bash
cd automation && npm install && npm start
cd ../site && npm install && npm run dev
```

Before running `automation` for real, edit [`automation/sources.json`](automation/sources.json) —
it ships with two starter RSS feeds (Daily Dot, Kotaku) and a starter keyword
list. Add/remove feeds and tune the keyword list to match your definition of
"digital drama."

### 5. Hosting the frontend (Cloudflare Workers)

Deployed via `wrangler` (config in `site/wrangler.jsonc`), not a dashboard
build pipeline — the site is fully static (no adapter; the TTS route lives in
the separate backend repo), published as Workers static assets.

1. `cd site && npx wrangler login` once, locally, to authenticate.
2. Build with the right env vars, then deploy:
   ```bash
   PUBLIC_TTS_API_URL="https://<tts-backend-url>/api/tts" npm run build
   npx wrangler deploy
   ```
   `MONGODB_URI` also needs to be set for the build step, since pages query
   Mongo in frontmatter.
3. For CI (the hourly workflow, step 6) to redeploy automatically, create a
   scoped Cloudflare API token (My Profile → API Tokens → Create Token →
   "Edit Cloudflare Workers" template, no IP restriction since GitHub-hosted
   runners don't have a fixed IP) and add it as a `CLOUDFLARE_API_TOKEN`
   secret, alongside `CLOUDFLARE_ACCOUNT_ID`.

### 5b. Hosting the TTS backend (Netlify)

See [`digitaldrama-tts-backend/README.md`](../digitaldrama-tts-backend/README.md) —
separate repo, separate Netlify site. Set `ALLOWED_ORIGIN` there to this site's
real Cloudflare Pages domain once known.

### 6. GitHub Actions secrets

Under Settings → Secrets and variables → Actions, add:

- `MONGODB_URI`
- `LLM_API_KEY`
- `CARTESIA_API_KEY`, `CARTESIA_API_KEY_2`, `CARTESIA_API_KEY_3`,
  `CARTESIA_BACKUP_API_KEY` (only used if `PREGENERATE_AUDIO=true`; idle by default)
- `CLOUDFLARE_API_TOKEN` — a scoped token (the "Edit Cloudflare Workers" template)
  used by `npx wrangler deploy` to publish the frontend after each run
- `CLOUDFLARE_ACCOUNT_ID`

### 7. End-to-end test

Manually run the workflow once (Actions tab → "Hourly drama fetch" →
"Run workflow") and confirm: RSS fetch → filter → LLM → MongoDB write →
frontend build → `wrangler deploy` → new article visible on the live site.
Then let the hourly schedule take over.

## Notes

- **Dedupe** is enforced by a unique index on `sourceUrl`, so the same story
  won't get reprocessed every hour as it recurs in the feed.
- **Cost control**: the keyword filter runs before the LLM call, so only
  plausibly-relevant items ever hit the LLM API.
- **Legal/accuracy**: every article links back to its source, the LLM prompt
  requires a rewrite in the author's own words plus distinct opinion (not a
  close paraphrase), and disputed claims about real people should be framed
  as reported/alleged. Consider adding a manual review step (write to a
  `pending` collection, approve, then move to `articles`) before fully
  auto-publishing — this scaffold auto-publishes by default.

# Rebrand: DigitalDrama → DigitalDramaa

Domain decision: `digitaldramaa.com` (over `latestdigitaldrama.com`).

## Done

All user-facing copy and metadata renamed from "DigitalDrama" to "DigitalDramaa" across `site/`:

- Header and footer wordmark, footer copyright line
- Page titles, meta descriptions, keywords, OG/Twitter tags (home, about, contact, terms, privacy, archive, article, tag pages, 404/500)
- Body copy (FAQ, about, terms, privacy, contact, footer blurb)
- Contact emails → `hello@digitaldramaa.com`
- `astro.config.mjs` site URL, `robots.txt` sitemap URL, `sitemap.xml.ts` fallback URL → `digitaldramaa.com`
- Regenerated `public/og-image.png` with the new wordmark (via `scripts/generate-og-image.mjs`)
- `automation/src/llm.js` system prompt, so new articles are written "for Digital Dramaa"

## Pending decisions (infra, not copy — left untouched)

1. **`site/wrangler.jsonc`** — `"name": "digitaldrama"` controls the Cloudflare Workers subdomain (`digitaldrama.mauricerana.workers.dev`) and the CI deploy target. Renaming it creates a *new* worker; secrets/env vars would need to be re-added there, and the new custom domain would need to point at whichever worker ends up live.
2. **MongoDB database name** — both `site/src/lib/mongodb.ts` and `automation/src/db.js` use `db("digitalDrama")`. Renaming this in code without renaming the actual Atlas database would point the site at an empty database and break it.

## Not yet done

- DNS/domain setup for `digitaldramaa.com` (in progress by user)
- Actually receiving mail at `hello@digitaldramaa.com` (currently just a displayed address)

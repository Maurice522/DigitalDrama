import "dotenv/config";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import Parser from "rss-parser";

import { connectDb, alreadyExists, recentTopicExists, saveAudio } from "./db.js";
import { isDigitalDrama } from "./filter.js";
import { extractImage } from "./image.js";
import { downloadImage } from "./downloadImage.js";
import { generateArticleImage } from "./imageGen.js";
import { generatePixelArt } from "./pixelArt.js";
import { generateAudio } from "./tts.js";
import { rewriteWithOpinion } from "./llm.js";
import { slugify } from "./slugify.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

const MONGODB_URI = process.env.MONGODB_URI;
const LLM_API_KEY = process.env.LLM_API_KEY;
const DEPLOY_HOOK_URL = process.env.DEPLOY_HOOK_URL;
// Off by default: pre-generating TTS for every new article burns Cartesia
// quota on sections nobody may ever ask to hear. Audio is instead generated
// once, live, the first time a listener requests it (site/src/pages/api/tts.ts),
// then cached in Mongo from there. Set PREGENERATE_AUDIO=true to restore the
// old behavior of generating both sections at creation time.
const PREGENERATE_AUDIO = process.env.PREGENERATE_AUDIO === "true";
const CARTESIA_API_KEYS = [
  process.env.CARTESIA_API_KEY,
  process.env.CARTESIA_API_KEY_2,
  process.env.CARTESIA_API_KEY_3,
  process.env.CARTESIA_BACKUP_API_KEY,
].filter(Boolean);

if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
if (!LLM_API_KEY) throw new Error("LLM_API_KEY is not set");

const { feeds, keywords } = JSON.parse(readFileSync(join(__dirname, "..", "sources.json"), "utf-8"));

async function main() {
  const parser = new Parser({
    customFields: { item: ["media:content", "media:thumbnail"] },
  });
  const { client, articles, audio } = await connectDb(MONGODB_URI);
  let addedCount = 0;

  try {
    for (const feed of feeds) {
      console.log(`Fetching ${feed.name}...`);
      let parsedFeed;
      try {
        parsedFeed = await parser.parseURL(feed.url);
      } catch (err) {
        console.error(`Failed to fetch ${feed.name}: ${err.message}`);
        continue;
      }

      for (const item of parsedFeed.items) {
        const sourceUrl = item.link;
        if (!sourceUrl) continue;

        if (await alreadyExists(articles, sourceUrl)) continue;

        if (!isDigitalDrama(item, keywords)) continue;

        console.log(`Relevant: ${item.title}`);

        // Prefer the source's own image over a generated one. Either way we
        // end up storing our own copy — the source URL is only ever used to
        // download from, never rendered directly, so the site never
        // hotlinks a publisher's CDN.
        const originImageUrl = extractImage(item);

        // Run the text rewrite and the hero image fetch/generation in
        // parallel rather than one after another, so neither adds latency
        // on top of the other.
        const [rewrittenResult, heroImageResult] = await Promise.allSettled([
          rewriteWithOpinion(item, LLM_API_KEY),
          originImageUrl
            ? downloadImage(originImageUrl)
            : generateArticleImage({ title: item.title, context: item.contentSnippet }),
        ]);

        if (rewrittenResult.status === "rejected") {
          console.error(`LLM rewrite failed for "${item.title}": ${rewrittenResult.reason.message}`);
          continue;
        }
        const rewritten = rewrittenResult.value;

        // Check before spending image/audio generation on an article we're
        // about to discard as a duplicate topic.
        if (await recentTopicExists(articles, rewritten.tags)) {
          console.log(`Skipping, topic covered in the last 2 hours: ${item.title} [${rewritten.tags.join(", ")}]`);
          continue;
        }

        // A stored data URI either way (downloaded origin image or
        // AI-generated) — null only if both the download and generation
        // paths failed, in which case the site falls back to pixel art.
        const heroImage = heroImageResult.status === "fulfilled" ? heroImageResult.value : null;
        // Local, synchronous, and seeded from the opinion text, so it always
        // runs after the rewrite rather than in parallel with it.
        const generatedPixelArt = generatePixelArt({ title: item.title, context: rewritten.opinion });

        const publishedAt = item.isoDate ?? item.pubDate ?? new Date().toISOString();
        const article = {
          title: item.title,
          slug: slugify(item.title, publishedAt),
          summary: rewritten.summary,
          opinion: rewritten.opinion,
          image: heroImage,
          pixelArt: generatedPixelArt,
          sourceUrl,
          sourceName: feed.name,
          publishedAt,
          tags: rewritten.tags,
          createdAt: new Date().toISOString(),
        };

        try {
          await articles.insertOne(article);
          addedCount += 1;
          console.log(`Saved: ${article.slug}`);
        } catch (err) {
          if (err.code === 11000) {
            console.log(`Duplicate, skipping: ${article.slug}`);
          } else {
            throw err;
          }
        }

        if (PREGENERATE_AUDIO) {
          const [summaryAudioResult, opinionAudioResult] = await Promise.allSettled([
            generateAudio(rewritten.summary, CARTESIA_API_KEYS),
            generateAudio(rewritten.opinion, CARTESIA_API_KEYS),
          ]);
          const summaryAudio = summaryAudioResult.status === "fulfilled" ? summaryAudioResult.value : null;
          const opinionAudio = opinionAudioResult.status === "fulfilled" ? opinionAudioResult.value : null;
          if (summaryAudio) await saveAudio(audio, article.slug, "summary", summaryAudio);
          if (opinionAudio) await saveAudio(audio, article.slug, "opinion", opinionAudio);
        }
      }
    }
  } finally {
    await client.close();
  }

  console.log(`Done. ${addedCount} new article(s) added.`);

  if (addedCount > 0 && DEPLOY_HOOK_URL) {
    console.log("Triggering deploy hook...");
    const res = await fetch(DEPLOY_HOOK_URL, { method: "POST" });
    console.log(`Deploy hook responded with ${res.status}`);
  } else if (addedCount > 0) {
    console.log("DEPLOY_HOOK_URL not set, skipping rebuild trigger.");
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

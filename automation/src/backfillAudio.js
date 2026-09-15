import "dotenv/config";

import { connectDb, getCachedAudio, saveAudio } from "./db.js";
import { generateAudio } from "./tts.js";

const MONGODB_URI = process.env.MONGODB_URI;
const CARTESIA_API_KEYS = [
  process.env.CARTESIA_API_KEY,
  process.env.CARTESIA_API_KEY_2,
  process.env.CARTESIA_API_KEY_3,
  process.env.CARTESIA_BACKUP_API_KEY,
].filter(Boolean);

if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
if (CARTESIA_API_KEYS.length === 0) throw new Error("CARTESIA_API_KEY is not set");

async function main() {
  const { client, articles, audio } = await connectDb(MONGODB_URI);

  try {
    const all = await articles.find({}, { projection: { slug: 1, title: 1, summary: 1, opinion: 1 } }).toArray();
    console.log(`Checking audio for ${all.length} article(s).`);

    for (const article of all) {
      const hasSummary = await getCachedAudio(audio, article.slug, "summary");
      if (!hasSummary) {
        console.log(`Generating summary audio: ${article.title}`);
        const clip = await generateAudio(article.summary, CARTESIA_API_KEYS);
        if (clip) {
          await saveAudio(audio, article.slug, "summary", clip);
          console.log(`Saved summary audio: ${article.slug}`);
        } else {
          console.log(`No summary audio generated for: ${article.slug}`);
        }
      }

      const hasOpinion = await getCachedAudio(audio, article.slug, "opinion");
      if (!hasOpinion) {
        console.log(`Generating opinion audio: ${article.title}`);
        const clip = await generateAudio(article.opinion, CARTESIA_API_KEYS);
        if (clip) {
          await saveAudio(audio, article.slug, "opinion", clip);
          console.log(`Saved opinion audio: ${article.slug}`);
        } else {
          console.log(`No opinion audio generated for: ${article.slug}`);
        }
      }
    }
  } finally {
    await client.close();
  }

  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

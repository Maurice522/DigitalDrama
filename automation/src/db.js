import dns from "node:dns";
import { MongoClient } from "mongodb";

// Some networks (notably Windows behind certain routers/VPNs) refuse SRV
// record lookups, which mongodb+srv:// requires. Prefer public resolvers
// that support them, falling back to whatever was already configured.
dns.setServers(["1.1.1.1", "8.8.8.8", ...dns.getServers()]);

export async function connectDb(uri) {
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("digitalDrama");
  const articles = db.collection("articles");
  await articles.createIndex({ sourceUrl: 1 }, { unique: true });
  await articles.createIndex({ slug: 1 }, { unique: true });
  // Generated TTS audio lives in its own collection, not embedded on the
  // article document — that document is fetched in full on every homepage
  // and archive listing, and a multi-megabyte audio clip on every article
  // would bloat those queries for a feature only the article page uses. It
  // also sidesteps MongoDB's 16MB document limit, which a long article's
  // audio can approach on its own.
  const audio = db.collection("audio");
  await audio.createIndex({ slug: 1, section: 1 }, { unique: true });
  return { client, articles, audio };
}

export async function getCachedAudio(audio, slug, section) {
  const doc = await audio.findOne({ slug, section }, { projection: { audio: 1 } });
  return doc ? doc.audio : null;
}

export async function saveAudio(audio, slug, section, dataUri) {
  await audio.updateOne(
    { slug, section },
    { $set: { slug, section, audio: dataUri, updatedAt: new Date().toISOString() } },
    { upsert: true },
  );
}

export async function alreadyExists(articles, sourceUrl) {
  const existing = await articles.findOne({ sourceUrl }, { projection: { _id: 1 } });
  return Boolean(existing);
}

const TOPIC_COOLDOWN_MS = 2 * 60 * 60 * 1000;

// Avoid publishing near-duplicate coverage: skip if any of this item's tags
// were already covered by an article we inserted within the cooldown window.
export async function recentTopicExists(articles, tags, windowMs = TOPIC_COOLDOWN_MS) {
  if (!tags || tags.length === 0) return false;
  const since = new Date(Date.now() - windowMs).toISOString();
  const existing = await articles.findOne(
    { tags: { $in: tags }, createdAt: { $gte: since } },
    { projection: { _id: 1 } },
  );
  return Boolean(existing);
}

import dns from "node:dns";
import { MongoClient, type Db } from "mongodb";

// Some networks (notably Windows behind certain routers/VPNs) refuse SRV
// record lookups, which mongodb+srv:// requires. Prefer public resolvers
// that support them, falling back to whatever was already configured.
dns.setServers(["1.1.1.1", "8.8.8.8", ...dns.getServers()]);

export interface Article {
  _id?: string;
  title: string;
  slug: string;
  summary: string;
  opinion: string;
  image?: string | null;
  pixelArt?: string | null;
  sourceUrl: string;
  sourceName: string;
  publishedAt: string;
  tags: string[];
  createdAt: string;
}

const uri = import.meta.env.MONGODB_URI ?? process.env.MONGODB_URI;

let client: MongoClient | null = null;
let db: Db | null = null;

async function getDb(): Promise<Db> {
  if (db) return db;
  if (!uri) throw new Error("MONGODB_URI is not set");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("digitalDrama");
  return db;
}

export async function getArticles(): Promise<Article[]> {
  try {
    const database = await getDb();
    const articles = await database
      .collection<Article>("articles")
      .find({})
      .sort({ publishedAt: -1 })
      .toArray();
    return JSON.parse(JSON.stringify(articles));
  } catch (err) {
    console.warn(`[mongodb] Skipping articles, could not connect: ${(err as Error).message}`);
    return [];
  }
}

export async function getArticleBySlug(slug: string): Promise<Article | null> {
  try {
    const database = await getDb();
    const article = await database.collection<Article>("articles").findOne({ slug });
    return article ? JSON.parse(JSON.stringify(article)) : null;
  } catch (err) {
    console.warn(`[mongodb] Skipping article lookup, could not connect: ${(err as Error).message}`);
    return null;
  }
}

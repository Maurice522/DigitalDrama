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

export async function getDb(): Promise<Db> {
  if (db) return db;
  if (!uri) throw new Error("MONGODB_URI is not set");
  client = new MongoClient(uri);
  await client.connect();
  db = client.db("digitalDrama");
  return db;
}

// Layout, Header, and Footer each call getArticles() independently on every
// page, and this is a fully static build (output: "static") re-run per page
// — without caching, that's a full collection scan per page instead of one
// for the whole build.
let articlesPromise: Promise<Article[]> | null = null;

export async function getArticles(): Promise<Article[]> {
  if (articlesPromise) return articlesPromise;
  articlesPromise = (async () => {
    try {
      const database = await getDb();
      // Sorted in JS rather than via MongoDB's .sort() — articles now embed
      // downloaded hero images as data URIs, and the resulting documents are
      // large enough that an in-memory server-side sort across the whole
      // collection exceeds MongoDB's 32MB sort limit. We're already pulling
      // every document into memory for the build, so sorting here costs
      // nothing extra.
      const articles = await database
        .collection<Article>("articles")
        .find({})
        .toArray();
      articles.sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
      return JSON.parse(JSON.stringify(articles));
    } catch (err) {
      console.warn(`[mongodb] Skipping articles, could not connect: ${(err as Error).message}`);
      articlesPromise = null;
      return [];
    }
  })();
  return articlesPromise;
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

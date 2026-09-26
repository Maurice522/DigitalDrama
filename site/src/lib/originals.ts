import { getDb } from "./mongodb";

export interface OriginalPost {
  _id?: string;
  title: string;
  slug: string;
  author: string;
  body: string;
  excerpt: string;
  sources: { name: string; url: string }[];
  tags: string[];
  heroImage?: string | null;
  publishedAt: string;
  updatedAt?: string;
  evergreen?: boolean;
}

// Same cached-promise pattern as getArticles() in mongodb.ts — Layout,
// Header, and Footer only need articles today, but commentary pages (index +
// every [slug]) all call getOriginals() independently, so this avoids the
// same N-queries-per-build problem.
let originalsPromise: Promise<OriginalPost[]> | null = null;

export async function getOriginals(): Promise<OriginalPost[]> {
  if (originalsPromise) return originalsPromise;
  originalsPromise = (async () => {
    try {
      const database = await getDb();
      const posts = await database
        .collection<OriginalPost>("originals")
        .find({})
        .sort({ publishedAt: -1 })
        .toArray();
      return JSON.parse(JSON.stringify(posts));
    } catch (err) {
      console.warn(`[mongodb] Skipping originals, could not connect: ${(err as Error).message}`);
      originalsPromise = null;
      return [];
    }
  })();
  return originalsPromise;
}

export async function getOriginalBySlug(slug: string): Promise<OriginalPost | null> {
  const posts = await getOriginals();
  return posts.find((p) => p.slug === slug) ?? null;
}

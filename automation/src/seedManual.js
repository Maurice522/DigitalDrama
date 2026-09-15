import "dotenv/config";

import { connectDb, alreadyExists } from "./db.js";
import { rewriteWithOpinion } from "./llm.js";
import { slugify } from "./slugify.js";

const MONGODB_URI = process.env.MONGODB_URI;
const LLM_API_KEY = process.env.LLM_API_KEY;

if (!MONGODB_URI) throw new Error("MONGODB_URI is not set");
if (!LLM_API_KEY) throw new Error("LLM_API_KEY is not set");

// Manually curated items, in the same shape rss-parser would hand to
// rewriteWithOpinion (title / contentSnippet / link / isoDate), for stories
// that don't come from the configured RSS feeds.
const items = [
  {
    title: "AI Memory Is Sold Out, Causing an Unprecedented Surge in RAM Prices",
    contentSnippet:
      "Micron and other memory makers say demand for AI infrastructure has left conventional DRAM sold out, as manufacturers reallocate wafer capacity toward high-bandwidth memory (HBM) for AI accelerators. Samsung and Nvidia are named as central players in the reallocation, which is squeezing the supply of everyday PC and server memory and driving an unprecedented price surge.",
    link: "https://www.cnbc.com/2026/01/10/micron-ai-memory-shortage-hbm-nvidia-samsung.html",
    isoDate: "2026-01-10",
    sourceName: "CNBC",
  },
  {
    title: "RAM Prices Are So Bad, PC Builders Are Telling Customers to Bring Their Own Memory",
    contentSnippet:
      "Custom PC builder Maingear launched a 'bring your own RAM' program, letting customers supply their own memory or source it separately, after 16GB DDR5 sticks that cost under $200 three months ago began exceeding $500 on retailers like Amazon. Competitor Paradox Customs is now offering no-RAM configurations too. Micron and SK Hynix say the shortage, driven by AI infrastructure demand and tighter manufacturer allocation, could persist through 2026, with prices unlikely to improve until 2027 or 2028.",
    link: "https://gizmodo.com/ram-prices-are-so-bad-pc-builders-are-telling-consumers-to-byo-memory-2000702563",
    isoDate: "2025-12-23",
    sourceName: "Gizmodo",
  },
  {
    title: "TrendForce Sharply Upgrades 1Q26 Memory Price Outlook to Record Highs",
    contentSnippet:
      "TrendForce revised its 1Q26 conventional DRAM contract price forecast upward to a 90-95% quarter-over-quarter increase, from an earlier 55-60% estimate, with PC DRAM alone projected to more than double. NAND flash contract prices are forecast to rise 55-60% QoQ, up from a prior 33-38% forecast. The firm blames persistent AI and data-center demand plus PC shipment overages in 4Q25 for worsening the global memory supply and demand imbalance, with North American cloud providers stockpiling inventory for AI inference.",
    link: "https://www.trendforce.com/presscenter/news/20260202-12911.html",
    isoDate: "2026-02-02",
    sourceName: "TrendForce",
  },
];

async function main() {
  const { client, articles } = await connectDb(MONGODB_URI);
  let addedCount = 0;

  try {
    for (const item of items) {
      const sourceUrl = item.link;
      if (await alreadyExists(articles, sourceUrl)) {
        console.log(`Already exists, skipping: ${item.title}`);
        continue;
      }

      console.log(`Rewriting: ${item.title}`);
      let rewritten;
      try {
        rewritten = await rewriteWithOpinion(item, LLM_API_KEY);
      } catch (err) {
        console.error(`LLM rewrite failed for "${item.title}": ${err.message}`);
        continue;
      }

      const publishedAt = item.isoDate;
      const article = {
        title: item.title,
        slug: slugify(item.title, publishedAt),
        summary: rewritten.summary,
        opinion: rewritten.opinion,
        image: null,
        sourceUrl,
        sourceName: item.sourceName,
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
    }
  } finally {
    await client.close();
  }

  console.log(`Done. ${addedCount} new article(s) added.`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

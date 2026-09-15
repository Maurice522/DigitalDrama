import type { APIContext } from "astro";
import { getArticles } from "../lib/mongodb";
import { allTags } from "../lib/tags";

interface SitemapUrl {
  loc: string;
  lastmod?: string;
  changefreq: string;
  priority: string;
}

function renderUrl({ loc, lastmod, changefreq, priority }: SitemapUrl): string {
  return [
    "  <url>",
    `    <loc>${loc}</loc>`,
    lastmod ? `    <lastmod>${lastmod}</lastmod>` : null,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${priority}</priority>`,
    "  </url>",
  ]
    .filter(Boolean)
    .join("\n");
}

export async function GET({ site }: APIContext) {
  const siteUrl = (site?.toString() ?? "https://digitaldrama.com").replace(/\/$/, "");
  const articles = await getArticles();
  const tags = allTags(articles);

  const staticUrls: SitemapUrl[] = [
    { loc: "/", changefreq: "hourly", priority: "1.0" },
    { loc: "/blog", changefreq: "hourly", priority: "0.8" },
    { loc: "/about", changefreq: "monthly", priority: "0.5" },
    { loc: "/contact", changefreq: "monthly", priority: "0.5" },
    { loc: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
    { loc: "/terms-and-conditions", changefreq: "yearly", priority: "0.3" },
  ];

  const tagUrls: SitemapUrl[] = tags.map((tag) => ({
    loc: `/tag/${tag}`,
    changefreq: "daily",
    priority: "0.6",
  }));

  const articleUrls: SitemapUrl[] = articles.map((article) => ({
    loc: `/blog/${article.slug}`,
    lastmod: new Date(article.publishedAt ?? article.createdAt).toISOString(),
    changefreq: "weekly",
    priority: "0.7",
  }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...tagUrls, ...articleUrls]
  .map((url) => renderUrl({ ...url, loc: `${siteUrl}${url.loc}` }))
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
}

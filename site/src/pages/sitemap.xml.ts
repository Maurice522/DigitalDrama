import type { APIContext } from "astro";
import { getOriginals } from "../lib/originals";

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
  const siteUrl = (site?.toString() ?? "https://digitaldramaa.com").replace(/\/$/, "");
  const posts = await getOriginals();

  // The automated Archive (/blog/*, /tag/*) is intentionally excluded here —
  // those pages are noindex, so they don't belong in the sitemap either.
  const staticUrls: SitemapUrl[] = [
    { loc: "/", changefreq: "hourly", priority: "1.0" },
    { loc: "/commentary", changefreq: "weekly", priority: "0.8" },
    { loc: "/about", changefreq: "monthly", priority: "0.5" },
    { loc: "/editorial-policy", changefreq: "monthly", priority: "0.4" },
    { loc: "/contact", changefreq: "monthly", priority: "0.5" },
    { loc: "/privacy-policy", changefreq: "yearly", priority: "0.3" },
    { loc: "/terms-and-conditions", changefreq: "yearly", priority: "0.3" },
  ];

  const commentaryUrls: SitemapUrl[] = posts.map((post) => ({
    loc: `/commentary/${post.slug}`,
    lastmod: new Date(post.updatedAt ?? post.publishedAt).toISOString(),
    changefreq: "monthly",
    priority: "0.7",
  }));

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[...staticUrls, ...commentaryUrls]
  .map((url) => renderUrl({ ...url, loc: `${siteUrl}${url.loc}` }))
  .join("\n")}
</urlset>
`;

  return new Response(body, {
    headers: { "Content-Type": "application/xml" },
  });
}

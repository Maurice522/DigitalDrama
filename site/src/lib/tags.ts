import type { Article } from "./mongodb";

export const HUE_COUNT = 6;

export function hueIndexForTag(tag: string): number {
  let hash = 0;
  for (let i = 0; i < tag.length; i++) {
    hash = (hash * 31 + tag.charCodeAt(i)) >>> 0;
  }
  return hash % HUE_COUNT;
}

export function primaryTag(article: Pick<Article, "tags">): string | null {
  return article.tags?.[0] ?? null;
}

export interface TagGroup {
  tag: string;
  articles: Article[];
}

export function groupByTag(articles: Article[]): TagGroup[] {
  const groups = new Map<string, Article[]>();
  for (const article of articles) {
    for (const tag of article.tags ?? []) {
      if (!groups.has(tag)) groups.set(tag, []);
      groups.get(tag)!.push(article);
    }
  }
  return [...groups.entries()]
    .map(([tag, tagArticles]) => ({ tag, articles: tagArticles }))
    .sort((a, b) => b.articles.length - a.articles.length);
}

export function allTags(articles: Article[]): string[] {
  return groupByTag(articles).map((g) => g.tag);
}

export function formatTag(tag: string): string {
  return tag.replace(/-/g, " ");
}

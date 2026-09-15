export function extractImage(item) {
  if (item.enclosure?.url) return item.enclosure.url;

  const media = item["media:content"];
  if (media) {
    const first = Array.isArray(media) ? media[0] : media;
    if (first?.$?.url) return first.$.url;
  }

  const thumbnail = item["media:thumbnail"];
  if (thumbnail) {
    const first = Array.isArray(thumbnail) ? thumbnail[0] : thumbnail;
    if (first?.$?.url) return first.$.url;
  }

  const html = item.content ?? item["content:encoded"] ?? "";
  const match = html.match(/<img[^>]+src="([^"]+)"/i);
  if (match) return match[1];

  return null;
}

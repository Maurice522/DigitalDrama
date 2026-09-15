export function slugify(title, publishedAt) {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 80);
  const datePart = new Date(publishedAt).toISOString().slice(0, 10);
  return `${datePart}-${base}`;
}

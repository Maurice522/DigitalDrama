import sharp from "sharp";

// Every stored image ends up embedded as a data URI directly in static HTML
// — on the article's own page, and again on every homepage/archive/tag/
// related-story card that features it — so an uncompressed original-size
// photo gets multiplied many times over across the build. Re-encoding to a
// small WebP at ingest time keeps that cost bounded regardless of how large
// the source photo was.
const MAX_WIDTH = 800;
const QUALITY = 75;

export async function compressImage(buffer) {
  const webp = await sharp(buffer)
    .resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .webp({ quality: QUALITY })
    .toBuffer();
  return { buffer: webp, contentType: "image/webp" };
}

export function toDataUri({ buffer, contentType }) {
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

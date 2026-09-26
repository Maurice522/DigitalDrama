import { compressImage, toDataUri } from "./imageOptimize.js";

// Publisher-hosted images are downloaded once at ingest time, compressed,
// and stored as a self-contained data URI, the same shape imageGen.js
// already uses for AI-generated images — so the site never hotlinks a
// third-party CDN and never depends on the source image staying reachable
// later.
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_BYTES = 5 * 1024 * 1024;

export async function downloadImage(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
    if (!response.ok) {
      console.warn(`[downloadImage] ${url} responded ${response.status}, skipping`);
      return null;
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.startsWith("image/")) {
      console.warn(`[downloadImage] ${url} content-type "${contentType}" isn't an image, skipping`);
      return null;
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_BYTES) {
      console.warn(`[downloadImage] ${url} is ${contentLength} bytes, over the ${MAX_BYTES} cap, skipping`);
      return null;
    }

    const buffer = Buffer.from(await response.arrayBuffer());
    if (buffer.byteLength > MAX_BYTES) {
      console.warn(`[downloadImage] ${url} decoded to ${buffer.byteLength} bytes, over the ${MAX_BYTES} cap, skipping`);
      return null;
    }

    const compressed = await compressImage(buffer);
    return toDataUri(compressed);
  } catch (err) {
    console.warn(`[downloadImage] Failed to download ${url}: ${err.message}`);
    return null;
  }
}

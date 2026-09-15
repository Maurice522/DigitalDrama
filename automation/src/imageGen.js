// Free, keyless image generation via Pollinations.ai (Stable Diffusion/Flux
// backend, no API key or billing required). We fetch the bytes once at
// generation time and store them as a data URI, so the site never depends on
// Pollinations being reachable later.
const REQUEST_TIMEOUT_MS = 60_000;

async function fetchGeneratedImage(prompt, { width, height }) {
  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    nologo: "true",
  });
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?${params.toString()}`;

  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) {
    throw new Error(`Pollinations request failed: ${response.status} ${await response.text().catch(() => "")}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";
  return `data:${contentType};base64,${buffer.toString("base64")}`;
}

// The free Pollinations service has variable latency and occasionally times
// out under load, so a lone failure isn't treated as final.
async function fetchWithRetry(prompt, dimensions, attempts = 2) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      return await fetchGeneratedImage(prompt, dimensions);
    } catch (err) {
      lastErr = err;
    }
  }
  throw lastErr;
}

export async function generateArticleImage({ title, context }) {
  const prompt = [
    "Editorial illustration for an internet-culture news article",
    `headline: ${title}`,
    context ? `context: ${String(context).slice(0, 300)}` : "",
    "dramatic modern digital illustration, magazine cover quality, high contrast, cinematic lighting, no text, no logos, no watermarks",
  ]
    .filter(Boolean)
    .join(". ");

  try {
    return await fetchWithRetry(prompt, { width: 1024, height: 640 });
  } catch (err) {
    console.error(`Image generation failed for "${title}": ${err.message}`);
    return null;
  }
}

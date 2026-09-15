const CARTESIA_VOICE_ID = "a33f7a4c-100f-41cf-a1fd-5822e8fc253f";
const REQUEST_TIMEOUT_MS = 60_000;

async function callCartesia(text, apiKey) {
  const response = await fetch("https://api.cartesia.ai/tts/bytes", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
      "Cartesia-Version": "2026-08-14",
    },
    body: JSON.stringify({
      model_id: "sonic-3.6",
      transcript: text,
      voice: { mode: "id", id: CARTESIA_VOICE_ID },
      // mp3 rather than raw wav — a full section at normal speed easily
      // produces an 8-9MB uncompressed wav, which is both wasteful to
      // store/transfer and risks pushing a document over MongoDB's 16MB
      // limit. mp3 at 64kbps is ~6x smaller with no audible quality loss
      // for spoken word.
      output_format: { container: "mp3", bit_rate: 64000, sample_rate: 44100 },
      generation_config: { speed: 1, volume: 0.7, emotion: "excited" },
    }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    const err = new Error(`Cartesia request failed: ${response.status} ${body}`);
    err.status = response.status;
    err.isQuotaError = response.status === 402;
    throw err;
  }

  return Buffer.from(await response.arrayBuffer());
}

// Accepts one key or an array of keys, tried in order. Only a quota/credit
// error (402) falls through to the next key — any other failure (bad
// request, network issue, auth) stops immediately since retrying with a
// different key won't fix it.
export async function generateAudio(text, apiKeyOrKeys) {
  const keys = (Array.isArray(apiKeyOrKeys) ? apiKeyOrKeys : [apiKeyOrKeys]).filter(Boolean);
  if (keys.length === 0 || !text || !text.trim()) return null;

  let lastErr;
  for (let i = 0; i < keys.length; i++) {
    try {
      const buffer = await callCartesia(text, keys[i]);
      return `data:audio/mpeg;base64,${buffer.toString("base64")}`;
    } catch (err) {
      lastErr = err;
      if (!err.isQuotaError) break;
      console.warn(`Cartesia key #${i + 1} out of quota, trying next key...`);
    }
  }

  console.error(`Audio generation failed: ${lastErr.message}`);
  return null;
}

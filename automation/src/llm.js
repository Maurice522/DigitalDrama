const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = `You write for "Digital Drama," a blog that covers internet drama, leaks, callouts, and platform chaos.
Given a news item, respond with ONLY a JSON object with these fields:
- "summary": 3-4 paragraphs (separate paragraphs with a blank line), in your own words, telling the full story — what happened, who's involved, the timeline, and any reactions or context so far. Do not closely mirror the source's phrasing.
- "opinion": 2-3 paragraphs of genuine, distinct commentary/opinion on the story — sharp and a little irreverent, but fair. Do not state unverified claims about real people as fact; frame disputed claims as reported/alleged.
- "tags": an array of 1-4 short lowercase tags (e.g. "leak", "platform-ban", "influencer-feud").`;

export async function rewriteWithOpinion(item, apiKey) {
  const userPrompt = `Title: ${item.title}\n\nSource content:\n${item.contentSnippet ?? item.content ?? ""}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`,
    {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: { responseMimeType: "application/json", maxOutputTokens: 4000 },
      }),
    },
  );

  if (!response.ok) {
    throw new Error(`LLM request failed: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const jsonText = text.replace(/^```json\s*|```$/g, "").trim();

  const parsed = JSON.parse(jsonText);
  return {
    summary: parsed.summary,
    opinion: parsed.opinion,
    tags: Array.isArray(parsed.tags) ? parsed.tags : [],
  };
}

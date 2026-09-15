export function toParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/\*(.+?)\*/g, "$1");
}

export function excerpt(text: string, maxLength = 240): string {
  const firstParagraph = stripMarkdown(toParagraphs(text)[0] ?? text);
  if (firstParagraph.length <= maxLength) return firstParagraph;
  return `${firstParagraph.slice(0, maxLength).trimEnd()}…`;
}

// The LLM occasionally writes markdown emphasis (*italic*, **bold**) even
// though the prompt asks for plain prose. Render it properly instead of
// showing literal asterisks. Escapes HTML first since this is rendered with
// set:html.
export function renderInlineMarkdown(text: string): string {
  const escaped = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>");
}

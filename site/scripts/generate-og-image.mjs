import sharp from "sharp";
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

const WIDTH = 1200;
const HEIGHT = 630;

// A few of the same accent squares used for the site's pixel-art motif,
// scattered as a decorative strip rather than trying to reproduce any
// specific article's generated art.
const squareColors = ["#0e8f5b", "#b5601f", "#1d5fbf", "#6e3fbf", "#b5303a", "#0e7e8f"];
const squareSize = 22;
const squares = squareColors
  .map((color, i) => `<rect x="${820 + i * (squareSize + 6)}" y="486" width="${squareSize}" height="${squareSize}" rx="3" fill="${color}" />`)
  .join("\n");

const svg = `
<svg width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}" xmlns="http://www.w3.org/2000/svg">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="#f6f4ef" />
  <rect x="0" y="0" width="${WIDTH}" height="10" fill="#0e8f5b" />
  <text x="80" y="300" font-family="Arial, Helvetica, sans-serif" font-weight="800" font-size="108" letter-spacing="-2">
    <tspan fill="#16181b">DIGITAL</tspan><tspan fill="#0e8f5b">DRAMA</tspan>
  </text>
  <text x="82" y="360" font-family="Arial, Helvetica, sans-serif" font-weight="600" font-size="30" fill="#5b6169">
    Live commentary on internet drama, leaks, and platform chaos
  </text>
  <text x="82" y="410" font-family="Arial, Helvetica, sans-serif" font-weight="500" font-size="22" fill="#8a8f96">
    Refreshed hourly, straight from the source
  </text>
  ${squares}
</svg>
`;

const outPath = join(__dirname, "..", "public", "og-image.png");
const png = await sharp(Buffer.from(svg)).png().toBuffer();
writeFileSync(outPath, png);
console.log(`Wrote ${outPath} (${png.length} bytes)`);

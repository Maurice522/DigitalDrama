import sharp from "sharp";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const svgPath = join(__dirname, "..", "public", "favicon.svg");
const outPath = join(__dirname, "..", "public", "favicon.ico");

const SIZES = [16, 32, 48];
const svg = readFileSync(svgPath);

const pngBuffers = await Promise.all(
  SIZES.map((size) => sharp(svg, { density: 384 }).resize(size, size).png().toBuffer())
);

// Modern ICO files can embed plain PNG frames instead of raw BMP data —
// every current Windows/browser icon reader accepts this, and it avoids
// hand-rolling a BMP/DIB encoder just for a favicon.
const headerSize = 6;
const dirEntrySize = 16;
const dataOffset0 = headerSize + dirEntrySize * SIZES.length;

const header = Buffer.alloc(headerSize);
header.writeUInt16LE(0, 0); // reserved
header.writeUInt16LE(1, 2); // type: icon
header.writeUInt16LE(SIZES.length, 4); // image count

let offset = dataOffset0;
const dirEntries = [];
for (let i = 0; i < SIZES.length; i++) {
  const size = SIZES[i];
  const png = pngBuffers[i];
  const entry = Buffer.alloc(dirEntrySize);
  entry.writeUInt8(size === 256 ? 0 : size, 0); // width
  entry.writeUInt8(size === 256 ? 0 : size, 1); // height
  entry.writeUInt8(0, 2); // color count
  entry.writeUInt8(0, 3); // reserved
  entry.writeUInt16LE(1, 4); // color planes
  entry.writeUInt16LE(32, 6); // bits per pixel
  entry.writeUInt32LE(png.length, 8); // size of image data
  entry.writeUInt32LE(offset, 12); // offset of image data
  dirEntries.push(entry);
  offset += png.length;
}

const ico = Buffer.concat([header, ...dirEntries, ...pngBuffers]);
writeFileSync(outPath, ico);
console.log(`Wrote ${outPath} (${ico.length} bytes, sizes: ${SIZES.join(", ")})`);

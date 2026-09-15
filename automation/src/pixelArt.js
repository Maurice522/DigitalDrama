import zlib from "node:zlib";

const GRID_SIZE = 7;
const HALF = Math.ceil(GRID_SIZE / 2); // columns 0..3 are generated, then mirrored

// Bright, modern accent palette — every icon draws from these two tones so
// it reads as "one design system" rather than random noise.
const PALETTE = [
  "#FF3D81", // hot pink
  "#7C4DFF", // electric violet
  "#00E5FF", // cyan
  "#00E676", // spring green
  "#FFD600", // vivid yellow
  "#FF6D00", // vivid orange
];

function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h * 31 + str.charCodeAt(i)) >>> 0;
  }
  return h >>> 0;
}

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexToRgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function buildGrid(seedText) {
  const rand = mulberry32(hashString(seedText));

  const primary = PALETTE[Math.floor(rand() * PALETTE.length)];
  let accent = PALETTE[Math.floor(rand() * PALETTE.length)];
  if (accent === primary) accent = PALETTE[(PALETTE.indexOf(primary) + 3) % PALETTE.length];
  const [pr, pg, pb] = hexToRgb(primary);
  const [ar, ag, ab] = hexToRgb(accent);

  const cells = Array.from({ length: GRID_SIZE }, () => Array(GRID_SIZE).fill(null));

  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < HALF; x++) {
      const filled = rand() < 0.55;
      const color = filled ? (rand() < 0.75 ? [pr, pg, pb] : [ar, ag, ab]) : null;
      cells[y][x] = color;
      cells[y][GRID_SIZE - 1 - x] = color;
    }
  }

  return cells;
}

// --- Minimal PNG encoder (no dependencies): builds an RGBA raster and wraps
// it in the smallest valid PNG (IHDR + one IDAT + IEND). ---

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = CRC_TABLE[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // color type: RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdr = pngChunk("IHDR", ihdrData);

  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const rowStart = y * (stride + 1);
    raw[rowStart] = 0; // filter type: none
    rgba.copy(raw, rowStart + 1, y * stride, y * stride + stride);
  }
  const idat = pngChunk("IDAT", zlib.deflateSync(raw));
  const iend = pngChunk("IEND", Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

/**
 * Generates a deterministic 7x7 pixel-grid icon (like a GitHub identicon) in
 * bright, modern colors. Seeded from the article's "Our take" opinion text
 * so the icon is tied to that specific take, not just the headline. Pure,
 * synchronous, and free — no network call.
 */
export function generatePixelArt({ title, context }) {
  const seedText = (context && context.trim()) || title || "digital-drama";
  const grid = buildGrid(seedText);

  const rgba = Buffer.alloc(GRID_SIZE * GRID_SIZE * 4);
  for (let y = 0; y < GRID_SIZE; y++) {
    for (let x = 0; x < GRID_SIZE; x++) {
      const idx = (y * GRID_SIZE + x) * 4;
      const color = grid[y][x];
      if (color) {
        rgba[idx] = color[0];
        rgba[idx + 1] = color[1];
        rgba[idx + 2] = color[2];
        rgba[idx + 3] = 255;
      } else {
        rgba[idx + 3] = 0; // transparent
      }
    }
  }

  const png = encodePNG(GRID_SIZE, GRID_SIZE, rgba);
  return `data:image/png;base64,${png.toString("base64")}`;
}

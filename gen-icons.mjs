import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

// Pure-Node PNG writer (no canvas dependency needed)
function writePNG(filePath, size, drawFn) {
  // Create pixel buffer (RGBA)
  const buf = Buffer.alloc(size * size * 4, 0);

  const setPixel = (x, y, r, g, b, a = 255) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return;
    const i = (y * size + x) * 4;
    buf[i] = r; buf[i+1] = g; buf[i+2] = b; buf[i+3] = a;
  };

  const fillRect = (x0, y0, x1, y1, r, g, b) => {
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        setPixel(x, y, r, g, b);
  };

  const fillCircle = (cx, cy, radius, r, g, b) => {
    for (let y = cy - radius; y <= cy + radius; y++)
      for (let x = cx - radius; x <= cx + radius; x++) {
        const dx = x - cx, dy = y - cy;
        if (dx*dx + dy*dy <= radius*radius) setPixel(x, y, r, g, b);
      }
  };

  const fillRing = (cx, cy, outerR, innerR, r, g, b) => {
    for (let y = cy - outerR; y <= cy + outerR; y++)
      for (let x = cx - outerR; x <= cx + outerR; x++) {
        const dx = x - cx, dy = y - cy;
        const d2 = dx*dx + dy*dy;
        if (d2 <= outerR*outerR && d2 >= innerR*innerR) setPixel(x, y, r, g, b);
      }
  };

  // Simple bitmap font for "TT" — 5x7 pixels per char, scale by fontScale
  const GLYPHS = {
    T: [
      [1,1,1,1,1],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
      [0,0,1,0,0],
    ],
    t: [
      [0,1,0],
      [1,1,1],
      [0,1,0],
      [0,1,0],
      [0,1,0],
      [0,1,1],
    ],
  };

  const drawGlyph = (char, startX, startY, scale, r, g, b) => {
    const glyph = GLYPHS[char] || [];
    for (let row = 0; row < glyph.length; row++)
      for (let col = 0; col < glyph[row].length; col++)
        if (glyph[row][col])
          fillRect(
            startX + col * scale, startY + row * scale,
            startX + (col + 1) * scale, startY + (row + 1) * scale,
            r, g, b
          );
  };

  drawFn({ setPixel, fillRect, fillCircle, fillRing, drawGlyph, size });

  // Encode as PNG
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (we'll drop alpha channel for simplicity)
  // Build raw scanlines (RGB, no alpha — simpler PNG)
  const raw = Buffer.alloc(size * (size * 3 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0; // filter byte
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * (size * 3 + 1) + 1 + x * 3;
      raw[dst] = buf[src]; raw[dst+1] = buf[src+1]; raw[dst+2] = buf[src+2];
    }
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crcBuf = Buffer.concat([typeB, data]);
    const crc = crc32(crcBuf);
    const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc >>> 0);
    return Buffer.concat([len, typeB, data, crcB]);
  };

  const out = Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", compressed),
    chunk("IEND", Buffer.alloc(0)),
  ]);

  fs.writeFileSync(filePath, out);
}

// CRC-32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[i] = c;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xFFFFFFFF;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function drawIcon({ fillRect, fillCircle, size }) {
  const s = size;

  // Mondrian palette (matches app design tokens)
  const CR = [240, 237, 229]; // cream  #F0EDE5
  const RD = [193,  18,  31]; // red    #C1121F
  const BL = [ 29,  53,  87]; // blue   #1D3557
  const YL = [232, 184,  75]; // gold   #E8B84B
  const BK = [ 10,  10,  10]; // black  #0A0A0A

  const lw  = Math.max(2, Math.round(s * 0.032)); // line width
  const pad = Math.round(s * 0.07);               // safe-area padding

  // Fill background cream
  fillRect(0, 0, s, s, ...CR);

  // Grid bounds
  const L = pad, T = pad, R = s - pad, B = s - pad;
  const W = R - L, H = B - T;

  // Mondrian cell dividers (asymmetric, like Composition II)
  const vx  = L + Math.round(W * 0.645); // main vertical
  const hy  = T + Math.round(H * 0.615); // main horizontal
  const bvx = L + Math.round(W * 0.34);  // bottom-left internal vertical

  // Fill cells
  fillRect(L,   T,   vx,  hy,  ...CR); // top-left large — cream
  fillRect(vx,  T,   R,   hy,  ...RD); // top-right       — red
  fillRect(L,   hy,  bvx, B,   ...BL); // bot-left        — blue
  fillRect(bvx, hy,  vx,  B,   ...YL); // bot-center      — gold
  fillRect(vx,  hy,  R,   B,   ...CR); // bot-right       — cream

  // Grid border
  fillRect(L,    T,    R,    T+lw, ...BK);
  fillRect(L,    B-lw, R,    B,    ...BK);
  fillRect(L,    T,    L+lw, B,    ...BK);
  fillRect(R-lw, T,    R,    B,    ...BK);

  // Internal grid lines
  fillRect(L,      hy-lw, R,      hy+lw, ...BK); // horizontal
  fillRect(vx-lw,  T,     vx+lw,  B,     ...BK); // main vertical
  fillRect(bvx-lw, hy,    bvx+lw, B,     ...BK); // bottom-left split
}

const iconsDir = path.join(process.cwd(), "public/icons");
fs.mkdirSync(iconsDir, { recursive: true });

for (const size of [32, 180, 192, 512]) {
  writePNG(path.join(iconsDir, `icon-${size}.png`), size, drawIcon);
  console.log(`✓ icon-${size}.png`);
}
console.log("Done.");

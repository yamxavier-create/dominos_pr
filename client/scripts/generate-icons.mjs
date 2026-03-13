/**
 * Generate PWA icons for Domino PR using pure Node.js (no external deps).
 * Creates simple domino-themed PNG icons with a dark green background,
 * a white domino tile shape, and dots pattern.
 *
 * Uses raw PNG encoding with zlib deflate.
 */
import { writeFileSync } from 'fs';
import { deflateSync } from 'zlib';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(__dirname, '..', 'public');

// Colors
const BG = [10, 26, 15];       // #0A1A0F dark green
const WHITE = [255, 255, 255];
const DOT_COLOR = [10, 26, 15]; // Same as BG for dots on white tile

function createPixelBuffer(width, height, drawFn) {
  // RGBA buffer
  const buf = Buffer.alloc(width * height * 4);

  function setPixel(x, y, r, g, b, a = 255) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const idx = (y * width + x) * 4;
    buf[idx] = r;
    buf[idx + 1] = g;
    buf[idx + 2] = b;
    buf[idx + 3] = a;
  }

  function fillRect(x0, y0, w, h, r, g, b, a = 255) {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        setPixel(x, y, r, g, b, a);
      }
    }
  }

  function fillCircle(cx, cy, radius, r, g, b, a = 255) {
    const r2 = radius * radius;
    for (let y = Math.floor(cy - radius); y <= Math.ceil(cy + radius); y++) {
      for (let x = Math.floor(cx - radius); x <= Math.ceil(cx + radius); x++) {
        const dx = x - cx;
        const dy = y - cy;
        if (dx * dx + dy * dy <= r2) {
          setPixel(x, y, r, g, b, a);
        }
      }
    }
  }

  function fillRoundedRect(x0, y0, w, h, radius, r, g, b, a = 255) {
    // Fill the main body
    fillRect(x0 + radius, y0, w - 2 * radius, h, r, g, b, a);
    fillRect(x0, y0 + radius, w, h - 2 * radius, r, g, b, a);
    // Fill corners
    fillCircle(x0 + radius, y0 + radius, radius, r, g, b, a);
    fillCircle(x0 + w - radius - 1, y0 + radius, radius, r, g, b, a);
    fillCircle(x0 + radius, y0 + h - radius - 1, radius, r, g, b, a);
    fillCircle(x0 + w - radius - 1, y0 + h - radius - 1, radius, r, g, b, a);
  }

  drawFn({ setPixel, fillRect, fillCircle, fillRoundedRect });
  return buf;
}

function drawDominoIcon(ctx, size, padding = 0) {
  const { fillRect, fillCircle, fillRoundedRect } = ctx;

  // Background
  fillRect(0, 0, size, size, ...BG);

  // Domino tile dimensions (vertical domino)
  const margin = Math.round(size * 0.15) + padding;
  const tileW = size - margin * 2;
  const tileH = size - margin * 2;
  const tileX = margin;
  const tileY = margin;
  const cornerR = Math.round(size * 0.04);

  // White domino tile
  fillRoundedRect(tileX, tileY, tileW, tileH, cornerR, ...WHITE);

  // Divider line (horizontal, splits domino into top/bottom halves)
  const divY = Math.round(tileY + tileH / 2 - size * 0.005);
  const divH = Math.max(2, Math.round(size * 0.01));
  fillRect(tileX + Math.round(tileW * 0.05), divY, Math.round(tileW * 0.9), divH, ...DOT_COLOR);

  // Dot radius
  const dotR = Math.round(size * 0.035);

  // Top half: 6 dots (3 rows x 2 cols)
  const topCY = tileY + tileH / 4;
  const halfH = tileH / 4;
  const leftDotX = tileX + tileW * 0.3;
  const rightDotX = tileX + tileW * 0.7;

  // Top-left column (3 dots)
  fillCircle(leftDotX, topCY - halfH * 0.5, dotR, ...DOT_COLOR);
  fillCircle(leftDotX, topCY, dotR, ...DOT_COLOR);
  fillCircle(leftDotX, topCY + halfH * 0.5, dotR, ...DOT_COLOR);

  // Top-right column (3 dots)
  fillCircle(rightDotX, topCY - halfH * 0.5, dotR, ...DOT_COLOR);
  fillCircle(rightDotX, topCY, dotR, ...DOT_COLOR);
  fillCircle(rightDotX, topCY + halfH * 0.5, dotR, ...DOT_COLOR);

  // Bottom half: 5 dots (like a 5 on dice)
  const botCY = tileY + tileH * 3 / 4;
  const centerX = tileX + tileW / 2;

  fillCircle(leftDotX, botCY - halfH * 0.4, dotR, ...DOT_COLOR);       // top-left
  fillCircle(rightDotX, botCY - halfH * 0.4, dotR, ...DOT_COLOR);      // top-right
  fillCircle(centerX, botCY, dotR, ...DOT_COLOR);                       // center
  fillCircle(leftDotX, botCY + halfH * 0.4, dotR, ...DOT_COLOR);       // bottom-left
  fillCircle(rightDotX, botCY + halfH * 0.4, dotR, ...DOT_COLOR);      // bottom-right
}

function encodePNG(width, height, rgbaBuffer) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function crc32(buf) {
    let crc = 0xFFFFFFFF;
    const table = [];
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    for (let i = 0; i < buf.length; i++) {
      crc = table[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
    }
    return (crc ^ 0xFFFFFFFF) >>> 0;
  }

  function makeChunk(type, data) {
    const typeData = Buffer.concat([Buffer.from(type), data]);
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crcVal = crc32(typeData);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crcVal);
    return Buffer.concat([len, typeData, crcBuf]);
  }

  // IHDR
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 2;  // color type: RGB (no alpha needed for icons)
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // IDAT - convert RGBA to RGB with filter bytes
  const rawData = Buffer.alloc(height * (1 + width * 3));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 3)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const srcIdx = (y * width + x) * 4;
      const dstIdx = y * (1 + width * 3) + 1 + x * 3;
      rawData[dstIdx] = rgbaBuffer[srcIdx];
      rawData[dstIdx + 1] = rgbaBuffer[srcIdx + 1];
      rawData[dstIdx + 2] = rgbaBuffer[srcIdx + 2];
    }
  }

  const compressed = deflateSync(rawData);

  // IEND
  const iend = Buffer.alloc(0);

  return Buffer.concat([
    signature,
    makeChunk('IHDR', ihdr),
    makeChunk('IDAT', compressed),
    makeChunk('IEND', iend),
  ]);
}

function generateIcon(size, maskable = false) {
  const padding = maskable ? Math.round(size * 0.1) : 0; // 10% extra padding for safe zone
  const pixels = createPixelBuffer(size, size, (ctx) => {
    drawDominoIcon(ctx, size, padding);
  });
  return encodePNG(size, size, pixels);
}

// Generate all 4 icons
const icons = [
  { name: 'pwa-192x192.png', size: 192, maskable: false },
  { name: 'pwa-512x512.png', size: 512, maskable: false },
  { name: 'pwa-maskable-192x192.png', size: 192, maskable: true },
  { name: 'pwa-maskable-512x512.png', size: 512, maskable: true },
];

for (const icon of icons) {
  const png = generateIcon(icon.size, icon.maskable);
  const path = join(PUBLIC_DIR, icon.name);
  writeFileSync(path, png);
  console.log(`Created: ${icon.name} (${icon.size}x${icon.size}${icon.maskable ? ', maskable' : ''})`);
}

console.log('Done! All icons generated.');

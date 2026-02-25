/**
 * generate-icons.mjs
 * Creates PWA icon PNGs (192×192 and 512×512) using only Node.js built-ins.
 * Run: node scripts/generate-icons.mjs
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, '..', 'public');

// CRC32 table
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xffffffff;
  for (const byte of buf) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crcInput = Buffer.concat([typeBuf, data]);
  const crcBuf = Buffer.alloc(4);
  crcBuf.writeUInt32BE(crc32(crcInput));
  return Buffer.concat([len, typeBuf, data, crcBuf]);
}

function createSolidPNG(width, height, r, g, b) {
  // PNG signature
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth=8, color type=2 (RGB), compression=0, filter=0, interlace=0
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;  // bit depth
  ihdrData[9] = 2;  // color type: RGB
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  // Raw image data: each row = filter byte (0) + RGB pixels
  const rawRow = Buffer.alloc(1 + width * 3);
  rawRow[0] = 0; // filter: None
  for (let x = 0; x < width; x++) {
    rawRow[1 + x * 3] = r;
    rawRow[2 + x * 3] = g;
    rawRow[3 + x * 3] = b;
  }
  const rawData = Buffer.concat(Array(height).fill(rawRow));
  const compressed = deflateSync(rawData);

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdrData),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// Indigo color: #4f46e5 → R=79, G=70, B=229
const [R, G, B] = [79, 70, 229];

mkdirSync(publicDir, { recursive: true });

writeFileSync(join(publicDir, 'icon-192.png'), createSolidPNG(192, 192, R, G, B));
console.log('✓ public/icon-192.png created (192×192, indigo)');

writeFileSync(join(publicDir, 'icon-512.png'), createSolidPNG(512, 512, R, G, B));
console.log('✓ public/icon-512.png created (512×512, indigo)');

console.log('Icons generated successfully!');

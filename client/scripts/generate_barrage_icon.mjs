import sharp from 'sharp';
import path from 'node:path';
import fs from 'node:fs/promises';

const SRC = process.env.BARRAGE_SRC;
// Default to the icons folder this app already serves.
const OUT_DIR =
  process.env.BARRAGE_OUT_DIR ?? path.resolve(process.cwd(), 'public', 'icons');
const ICON_BASE = process.env.ICON_BASE ?? 'barrage';

if (!SRC) {
  console.error(
    'Missing env var BARRAGE_SRC. Usage:\n' +
      '  $env:BARRAGE_SRC="..."; $env:ICON_BASE="barrage"; node scripts/generate_barrage_icon.mjs',
  );
  process.exit(2);
}

const THRESHOLD = 95; // luminance >= threshold -> transparent (aggressive to drop dotted background)
const MIN_ALPHA = 40; // remove low-alpha noise before bbox/cropping
const CANVAS = 512;
const PADDING = 46;

async function alphaFromLuma(srcPath) {
  // 1-channel luma [0..255]
  const { data, info } = await sharp(srcPath)
    .greyscale()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const pixelCount = info.width * info.height;
  const channels = info.channels ?? 1;
  const alpha = Buffer.alloc(pixelCount);
  for (let i = 0; i < pixelCount; i++) {
    const lum = data[i * channels]; // greyscale but may still be 3-channel; take first
    if (lum >= THRESHOLD) alpha[i] = 0;
    else alpha[i] = Math.max(0, Math.min(255, Math.round((255 * (THRESHOLD - lum)) / THRESHOLD)));
  }
  // Drop tiny residual noise so bbox doesn't include background.
  for (let i = 0; i < alpha.length; i++) {
    if (alpha[i] < MIN_ALPHA) alpha[i] = 0;
  }
  return { alpha, width: info.width, height: info.height };
}

function bboxFromAlpha(alpha, width, height) {
  let minX = width,
    minY = height,
    maxX = -1,
    maxY = -1;

  for (let y = 0; y < height; y++) {
    const row = y * width;
    for (let x = 0; x < width; x++) {
      const v = alpha[row + x];
      if (v > 0) {
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) return null;
  return { left: minX, top: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

async function renderColor(alphaBuf, width, height, bbox, rgb) {
  const croppedAlpha = await sharp(alphaBuf, { raw: { width, height, channels: 1 } })
    .extract(bbox)
    .resize(CANVAS - 2 * PADDING, CANVAS - 2 * PADDING, {
      fit: 'inside',
      withoutEnlargement: true,
      kernel: sharp.kernel.lanczos3,
    })
    .raw()
    .toBuffer({ resolveWithObject: true });

  const aw = croppedAlpha.info.width;
  const ah = croppedAlpha.info.height;
  const aChannels = croppedAlpha.info.channels ?? 1;
  const aPixelCount = aw * ah;
  const a = Buffer.alloc(aPixelCount);
  for (let i = 0; i < aPixelCount; i++) {
    a[i] = croppedAlpha.data[i * aChannels];
  }

  const rgba = Buffer.alloc(aw * ah * 4);
  for (let i = 0, p = 0; i < a.length; i++, p += 4) {
    const av = a[i];
    rgba[p + 0] = rgb[0];
    rgba[p + 1] = rgb[1];
    rgba[p + 2] = rgb[2];
    rgba[p + 3] = av;
  }

  const left = Math.floor((CANVAS - aw) / 2);
  const top = Math.floor((CANVAS - ah) / 2);

  return sharp({
    create: { width: CANVAS, height: CANVAS, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: rgba, raw: { width: aw, height: ah, channels: 4 }, left, top }])
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const { alpha, width, height } = await alphaFromLuma(SRC);
  const bbox = bboxFromAlpha(alpha, width, height);
  if (!bbox) throw new Error('No foreground detected (alpha mask is empty).');

  const out = [
    { name: `${ICON_BASE}.png`, rgb: [0, 0, 0] },
    { name: `${ICON_BASE}_gris.png`, rgb: [160, 160, 160] },
    { name: `${ICON_BASE}_bleu.png`, rgb: [9, 132, 227] },
  ];

  for (const item of out) {
    const buf = await renderColor(alpha, width, height, bbox, item.rgb);
    const outPath = path.join(OUT_DIR, item.name);
    await fs.writeFile(outPath, buf);
    process.stdout.write(`wrote ${outPath}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});


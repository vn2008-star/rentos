/**
 * Renders the PWA / app icons from the RentOS mark.
 *
 *   npm run icons
 *
 * The mark itself lives in public/icon.svg as line art. Installed-app icons
 * cannot be line art on transparency: Android, iOS and Windows each composite
 * them onto backgrounds we do not control, and a thin cyan drawing disappears
 * on a light home screen. So each icon is rendered as a filled brand tile with
 * the mark knocked out in white — the same treatment the sidebar uses.
 *
 * Two families are produced:
 *   any       — the mark at 62% of the tile, for platforms that show the icon
 *               as supplied.
 *   maskable  — the mark at 46%, because Android crops maskable icons to an
 *               arbitrary shape and only the middle ~80% is guaranteed visible.
 *               Reusing the "any" artwork here would clip the roof.
 */

import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import sharp from "sharp";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");

/** The mark, drawn on a 64x64 grid. Kept in sync with public/icon.svg. */
const MARK = `
  <g fill="none" stroke="white" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10 21 L32 6.5 L54 21" stroke-width="5"/>
    <g stroke-width="1.4" opacity="0.95">
      <line x1="32.00" y1="36.50" x2="32.00" y2="24.50"/>
      <line x1="34.06" y1="37.17" x2="41.11" y2="27.46"/>
      <line x1="35.33" y1="38.92" x2="46.74" y2="35.21"/>
      <line x1="35.33" y1="41.08" x2="46.74" y2="44.79"/>
      <line x1="34.06" y1="42.83" x2="41.11" y2="52.54"/>
      <line x1="32.00" y1="43.50" x2="32.00" y2="55.50"/>
      <line x1="29.94" y1="42.83" x2="22.89" y2="52.54"/>
      <line x1="28.67" y1="41.08" x2="17.26" y2="44.79"/>
      <line x1="28.67" y1="38.92" x2="17.26" y2="35.21"/>
      <line x1="29.94" y1="37.17" x2="22.89" y2="27.46"/>
    </g>
    <g stroke-width="2">
      <ellipse cx="32" cy="40" rx="7.5" ry="15.5"/>
      <ellipse cx="32" cy="40" rx="15.5" ry="7.5"/>
    </g>
    <circle cx="32" cy="40" r="17" stroke-width="3.6"/>
    <circle cx="32" cy="40" r="3.4" stroke-width="2.8"/>
  </g>
`;

/** A square brand tile with the mark centred at `markRatio` of the tile width. */
function tile(size, markRatio) {
  const markSize = size * markRatio;
  const offset = (size - markSize) / 2;
  const scale = markSize / 64;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0090B4"/>
      <stop offset="100%" stop-color="#19C2A8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#bg)"/>
  <g transform="translate(${offset} ${offset}) scale(${scale})">${MARK}</g>
</svg>`;
}

const TARGETS = [
  { file: "icon-192.png", size: 192, ratio: 0.62 },
  { file: "icon-512.png", size: 512, ratio: 0.62 },
  { file: "icon-192-maskable.png", size: 192, ratio: 0.46 },
  { file: "icon-512-maskable.png", size: 512, ratio: 0.46 },
  // iOS home screen. Rendered separately because Safari ignores the manifest
  // icons and looks for this by convention.
  { file: "apple-touch-icon.png", size: 180, ratio: 0.62 },
];

await mkdir(outDir, { recursive: true });

for (const { file, size, ratio } of TARGETS) {
  const png = await sharp(Buffer.from(tile(size, ratio))).png().toBuffer();
  await writeFile(join(outDir, file), png);
  console.log(`  ${file.padEnd(26)} ${size}x${size}  ${(png.length / 1024).toFixed(1)} KB`);
}

// Safari looks for /apple-touch-icon.png at the site root.
const appleRoot = await sharp(Buffer.from(tile(180, 0.62))).png().toBuffer();
await writeFile(join(root, "public", "apple-touch-icon.png"), appleRoot);
console.log(`  apple-touch-icon.png (root)  180x180  ${(appleRoot.length / 1024).toFixed(1)} KB`);

console.log("\nIcons regenerated from the RentOS mark.");

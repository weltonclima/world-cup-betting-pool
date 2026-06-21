// Gera os ícones PWA a partir de public/logo-login.png.
// Reproduzível: `node scripts/generate-pwa-icons.mjs`. Saída em public/icons/.
// Fundo opaco branco (#ffffff) — iOS não respeita transparência; maskable não pode
// cortar a logo (safe-area central de ~80%).
import sharp from "sharp";
import { mkdir } from "node:fs/promises";

const SRC = "public/logo-login.png";
const OUT = "public/icons";
const BG = { r: 255, g: 255, b: 255, alpha: 1 }; // #ffffff (background_color do manifest)

/** Logo contida (sem cortar) num quadrado opaco de `size`, ocupando `coverage` do lado.
 *  `flatten` remove o canal alfa (apple-touch: iOS ignora transparência → sem alpha). */
async function makeIcon(size, coverage, file, flatten = false) {
  const inner = Math.round(size * coverage);
  const logo = await sharp(SRC)
    .resize(inner, inner, { fit: "contain", background: BG })
    .toBuffer();
  let pipeline = sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  }).composite([{ input: logo, gravity: "center" }]);
  if (flatten) pipeline = pipeline.flatten({ background: BG });
  await pipeline.png().toFile(`${OUT}/${file}`);
  console.log(`  ${file} (${size}x${size}, coverage ${coverage})`);
}

await mkdir(OUT, { recursive: true });
console.log("Gerando ícones PWA:");
await makeIcon(192, 0.9, "icon-192.png"); // any
await makeIcon(512, 0.9, "icon-512.png"); // any
await makeIcon(512, 0.8, "icon-maskable-512.png"); // maskable — safe-area 80%
await makeIcon(180, 0.85, "apple-touch-icon-180.png", true); // apple-touch (sem alpha)
console.log("OK");

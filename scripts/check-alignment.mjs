import { execSync } from "child_process";

for (let i = 1; i <= 12; i++) {
  const f = `public/assets/loading_sprites/frame-${String(i).padStart(3, "0")}.webp`;
  // Crop the bottom 40 pixels of non-empty content
  const bbox = execSync(`magick "${f}" -format "%@" info:`).toString().trim();
  const m = bbox.match(/^(\d+)x(\d+)\+(\d+)\+(\d+)$/);
  const [_, w, h, x, y] = m.map(Number);
  const bottom = y + h;
  const centerX = x + w / 2;
  console.log(`Frame ${i}: bottom=${bottom}, centerX=${centerX}, h=${h}, y=${y}`);
}

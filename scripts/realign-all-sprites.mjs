import { execSync } from "child_process";
import fs from "fs";
import path from "path";

const shifts = {
  1: -1,
  2: -1,
  3: 1,
  4: 4,
  5: 55,
  6: 59,
  7: 57,
  8: 60,
  9: -46,
  10: -46,
  11: -42,
  12: -45,
};

console.log("Aligning all 12 sprite frames to ground baseline Y = 418...");

for (let i = 1; i <= 12; i++) {
  const shift = shifts[i];
  const sign = shift >= 0 ? `+${shift}` : `${shift}`;
  const webpPath = `public/assets/loading_sprites/frame-${String(i).padStart(3, "0")}.webp`;
  const pngPath = `public/assets/loading_sprites/frame-${String(i).padStart(3, "0")}.png`;

  // Create temporary shifted image
  const tmpPng = `/tmp/frame_${i}.png`;
  execSync(`magick "${webpPath}" -page +0${sign} -background transparent -flatten "${tmpPng}"`);

  // Write to both public and src
  execSync(`magick "${tmpPng}" -quality 95 "${webpPath}"`);
  execSync(`cp "${tmpPng}" "${pngPath}"`);
  execSync(`cp "${webpPath}" "src/assets/loading_sprites/frame-${String(i).padStart(3, "0")}.webp"`);
  execSync(`cp "${pngPath}" "src/assets/loading_sprites/frame-${String(i).padStart(3, "0")}.png"`);

  const bbox = execSync(`magick "${webpPath}" -format "%@" info:`).toString().trim();
  console.log(`Aligned frame-${String(i).padStart(3, "0")}: bbox=${bbox}`);
}

console.log("Generating aligned Sujud logo with matching emblem position...");

// Scale logo content so emblem width matches Frame 12 (319px) and ground arc is at Y=418
execSync(`magick public/assets/loading_sprites/sujud-logo.webp -crop 238x226+138+128 +repage -resize 319x303\\! /tmp/scaled_logo_content.png`);
execSync(`magick -size 512x512 xc:transparent /tmp/scaled_logo_content.png -geometry +85+185 -composite /tmp/perfect_aligned_logo.png`);

// Save to public and src
execSync(`magick /tmp/perfect_aligned_logo.png -quality 95 "public/assets/loading_sprites/sujud-logo.webp"`);
execSync(`cp /tmp/perfect_aligned_logo.png "public/assets/loading_sprites/sujud-logo.png"`);
execSync(`cp "public/assets/loading_sprites/sujud-logo.webp" "src/assets/loading_sprites/sujud-logo.webp"`);
execSync(`cp /tmp/perfect_aligned_logo.png "src/assets/loading_sprites/sujud-logo.png"`);

const logoBbox = execSync(`magick "public/assets/loading_sprites/sujud-logo.webp" -format "%@" info:`).toString().trim();
console.log(`Aligned sujud-logo: bbox=${logoBbox}`);

console.log("All sprites successfully aligned!");

import { execSync } from "child_process";

console.log("Analyzing all 12 frames and logo...");

for (let i = 1; i <= 12; i++) {
  const f = `public/assets/loading_sprites/frame-${String(i).padStart(3, "0")}.webp`;
  const bbox = execSync(`magick "${f}" -format "%@" info:`).toString().trim();
  console.log(`frame-${String(i).padStart(3, "0")}: bbox=${bbox}`);
}

const logoBbox = execSync(`magick "public/assets/loading_sprites/sujud-logo.webp" -format "%@" info:`).toString().trim();
console.log(`sujud-logo: bbox=${logoBbox}`);

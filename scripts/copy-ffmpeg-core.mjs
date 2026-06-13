import { cpSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = join(dirname(fileURLToPath(import.meta.url)), "..");
const sourceDir = join(rootDir, "node_modules", "@ffmpeg", "core", "dist", "esm");
const targetDir = join(rootDir, "public", "ffmpeg");

if (!existsSync(sourceDir)) {
  console.warn("[copy-ffmpeg-core] @ffmpeg/core not installed, skipping");
  process.exit(0);
}

mkdirSync(targetDir, { recursive: true });
cpSync(join(sourceDir, "ffmpeg-core.js"), join(targetDir, "ffmpeg-core.js"));
cpSync(join(sourceDir, "ffmpeg-core.wasm"), join(targetDir, "ffmpeg-core.wasm"));
console.log("[copy-ffmpeg-core] Copied ffmpeg core assets to public/ffmpeg");

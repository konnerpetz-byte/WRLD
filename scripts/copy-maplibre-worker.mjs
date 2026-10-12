// Copies MapLibre's web worker into public/ so the map can load it at a stable URL.
// Runs automatically after `npm install` (see package.json "postinstall").
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/vendor", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/vendor/maplibre-gl-worker.mjs");
console.log("Copied MapLibre worker to public/vendor/");

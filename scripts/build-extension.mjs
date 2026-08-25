import { build } from "esbuild";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const vendorDirectory = path.join(root, "vendor");

await mkdir(path.join(root, "background"), { recursive: true });
await mkdir(path.join(root, "offscreen"), { recursive: true });
await mkdir(path.join(root, "page"), { recursive: true });
await mkdir(vendorDirectory, { recursive: true });

await build({
  entryPoints: [
    path.join(root, "src/background/service-worker.js"),
    path.join(root, "src/offscreen/inference.js"),
    path.join(root, "src/page/bridge.js"),
  ],
  outdir: root,
  outbase: path.join(root, "src"),
  bundle: true,
  format: "esm",
  platform: "browser",
  target: "chrome120",
  conditions: ["browser", "default"],
  minify: true,
  legalComments: "none",
});

const wppConnectDist = path.join(root, "node_modules/@wppconnect/wa-js/dist");
await copyFile(
  path.join(wppConnectDist, "wppconnect-wa.js"),
  path.join(root, "page/wppconnect-wa.js")
);
await copyFile(
  path.join(wppConnectDist, "wppconnect-wa.js.LICENSE.txt"),
  path.join(root, "page/wppconnect-wa.js.LICENSE.txt")
);

const onnxDist = path.join(root, "node_modules/onnxruntime-web/dist");
for (const file of [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
]) {
  await copyFile(path.join(onnxDist, file), path.join(vendorDirectory, file));
}

for (const file of [
  path.join(root, "background/service-worker.js"),
  path.join(root, "offscreen/inference.js"),
  path.join(root, "page/bridge.js"),
  path.join(vendorDirectory, "ort-wasm-simd-threaded.mjs"),
]) {
  const source = await readFile(file, "utf8");
  await writeFile(file, source.replace(/[ \t]+$/gm, ""));
}

console.log("Runtime local de IA compilado em background/ e vendor/.");

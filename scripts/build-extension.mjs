import { build } from "esbuild";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const vendorDirectory = path.join(root, "vendor");

await mkdir(path.join(root, "background"), { recursive: true });
await mkdir(path.join(root, "offscreen"), { recursive: true });
await mkdir(path.join(root, "page"), { recursive: true });
await mkdir(vendorDirectory, { recursive: true });

const buildResult = await build({
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
  write: false,
});

for (const outputFile of buildResult.outputFiles) {
  await writeIfChanged(outputFile.path, outputFile.contents, { trimTrailingSpaces: true });
}

const wppConnectDist = path.join(root, "node_modules/@wppconnect/wa-js/dist");
await copyIfChanged(
  path.join(wppConnectDist, "wppconnect-wa.js"),
  path.join(root, "page/wppconnect-wa.js")
);
await copyIfChanged(
  path.join(wppConnectDist, "wppconnect-wa.js.LICENSE.txt"),
  path.join(root, "page/wppconnect-wa.js.LICENSE.txt")
);

const onnxDist = path.join(root, "node_modules/onnxruntime-web/dist");
for (const file of [
  "ort-wasm-simd-threaded.mjs",
  "ort-wasm-simd-threaded.wasm",
]) {
  await copyIfChanged(path.join(onnxDist, file), path.join(vendorDirectory, file), {
    trimTrailingSpaces: file.endsWith(".mjs"),
  });
}

async function copyIfChanged(source, destination, options = {}) {
  const contents = await readFile(source);
  await writeIfChanged(destination, contents, options);
}

async function writeIfChanged(destination, contents, { trimTrailingSpaces = false } = {}) {
  const output = trimTrailingSpaces
    ? Buffer.from(Buffer.from(contents).toString("utf8").replace(/[ \t]+$/gm, ""))
    : Buffer.from(contents);

  try {
    const current = await readFile(destination);
    if (current.equals(output)) {
      return;
    }
  } catch (error) {
    if (error?.code !== "ENOENT") {
      throw error;
    }
  }

  await writeFile(destination, output);
}

console.log("Runtime local de IA compilado em background/ e vendor/.");

import { access, readFile, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const manifestPath = path.join(root, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));

const errors = [];

if (manifest.manifest_version !== 3) {
  errors.push("manifest_version deve ser 3.");
}

if (!/^\d+\.\d+\.\d+$/.test(manifest.version || "")) {
  errors.push("A versão do manifesto deve usar o formato X.Y.Z.");
}

if (!manifest.content_scripts?.length) {
  errors.push("O manifesto precisa registrar um content script.");
}

if (manifest.host_permissions?.length) {
  errors.push("A extensão local não deve solicitar permissões de hosts externos.");
}

if (manifest.cross_origin_embedder_policy?.value !== "require-corp") {
  errors.push("O manifesto precisa habilitar COEP para a inferência WASM paralela.");
}

if (manifest.cross_origin_opener_policy?.value !== "same-origin") {
  errors.push("O manifesto precisa habilitar COOP para a inferência WASM paralela.");
}

const referencedFiles = new Set([
  manifest.background?.service_worker,
  manifest.action?.default_popup,
  "offscreen/offscreen.html",
  "offscreen/inference.js",
  ...Object.values(manifest.icons || {}),
  ...Object.values(manifest.action?.default_icon || {}),
  "vendor/ort-wasm-simd-threaded.mjs",
  "vendor/ort-wasm-simd-threaded.wasm",
  "models/onnx-community/whisper-small/config.json",
  "models/onnx-community/whisper-small/onnx/encoder_model_quantized.onnx",
  "models/onnx-community/whisper-small/onnx/decoder_model_merged_quantized.onnx",
]);

const expectedModelSizes = new Map([
  ["models/onnx-community/whisper-small/onnx/encoder_model_quantized.onnx", 92_326_160],
  ["models/onnx-community/whisper-small/onnx/decoder_model_merged_quantized.onnx", 156_750_845],
]);

for (const entry of manifest.content_scripts || []) {
  for (const file of [...(entry.js || []), ...(entry.css || [])]) {
    referencedFiles.add(file);
  }
}

for (const relativeFile of referencedFiles) {
  if (!relativeFile) {
    continue;
  }

  try {
    const absoluteFile = path.join(root, relativeFile);
    await access(absoluteFile);

    const expectedSize = expectedModelSizes.get(relativeFile);
    if (expectedSize && (await stat(absoluteFile)).size !== expectedSize) {
      errors.push(`Arquivo do modelo local incompleto: ${relativeFile}`);
    }
  } catch {
    errors.push(`Arquivo referenciado não encontrado: ${relativeFile}`);
  }
}

if (errors.length > 0) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(
    `Manifesto ${manifest.name} v${manifest.version} válido (${referencedFiles.size} arquivos verificados).`
  );
}

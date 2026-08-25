import { env, pipeline } from "@huggingface/transformers";
import { cleanTranscript } from "../lib/transcript-cleanup.mjs";

const MODEL_ID = "onnx-community/whisper-base";
const MODEL_DTYPE = "q8";
const SAMPLE_RATE = 16000;
const MAX_BASE64_LENGTH = 35_000_000;

env.allowLocalModels = true;
env.allowRemoteModels = false;
env.localModelPath = chrome.runtime.getURL("models/");
env.useBrowserCache = false;
env.backends.onnx.wasm.numThreads = 1;
env.backends.onnx.wasm.proxy = false;
env.backends.onnx.wasm.wasmPaths = {
  mjs: chrome.runtime.getURL("vendor/ort-wasm-simd-threaded.mjs"),
  wasm: chrome.runtime.getURL("vendor/ort-wasm-simd-threaded.wasm"),
};

let transcriberPromise = null;
let inferenceQueue = Promise.resolve();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== "offscreen" || message.type !== "ZAP_TRANSCRIBE_AUDIO") {
    return false;
  }

  transcribeAudio(message.payload, {
    requestId: message.requestId,
    tabId: message.tabId,
    language: message.language,
  })
    .then((result) => sendResponse({ ok: true, result }))
    .catch((error) => {
      console.error("[ZapTranscriber] Falha na transcrição local", error);
      sendResponse({
        ok: false,
        error: normalizeError(error),
      });
    });

  return true;
});

async function transcribeAudio(payload, request) {
  validatePayload(payload);

  const wavBuffer = base64ToArrayBuffer(payload.audioBase64);
  const { samples, sampleRate } = decodePcm16Wav(wavBuffer);

  if (sampleRate !== SAMPLE_RATE) {
    throw new Error("A taxa de amostragem do áudio convertido é inválida.");
  }

  sendProgress(request, { stage: "loading", label: "Carregando IA local…" });
  const transcriber = await getTranscriber((progress) => {
    if (progress.status === "progress" && Number.isFinite(progress.progress)) {
      sendProgress(request, {
        stage: "loading",
        label: `Carregando IA local ${Math.round(progress.progress)}%…`,
      });
    }
  });

  sendProgress(request, { stage: "transcribing", label: "Transcrevendo localmente…" });

  const job = inferenceQueue.then(async () => {
    const options = {
      task: "transcribe",
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
      do_sample: false,
      max_new_tokens: 192,
      no_repeat_ngram_size: 6,
    };

    if (request.language && request.language !== "auto") {
      options.language = request.language;
    }

    return transcriber(samples, options);
  });

  inferenceQueue = job.catch(() => {});
  const output = await job;
  const text = cleanTranscript(output?.text);

  if (!text) {
    throw new Error("A IA local não identificou fala nesta mensagem.");
  }

  return {
    text,
    model: MODEL_ID,
    local: true,
  };
}

function getTranscriber(progressCallback) {
  if (!transcriberPromise) {
    transcriberPromise = pipeline("automatic-speech-recognition", MODEL_ID, {
      device: "wasm",
      dtype: MODEL_DTYPE,
      local_files_only: true,
      progress_callback: progressCallback,
    }).catch((error) => {
      transcriberPromise = null;
      throw error;
    });
  }

  return transcriberPromise;
}

function sendProgress({ tabId, requestId }, progress) {
  if (!Number.isInteger(tabId) || !requestId) {
    return;
  }

  chrome.runtime
    .sendMessage({
      type: "ZAP_OFFSCREEN_PROGRESS",
      target: "background",
      tabId,
      requestId,
      progress,
    })
    .catch(() => {});
}

function validatePayload(payload) {
  if (!payload || typeof payload.audioBase64 !== "string") {
    throw new Error("O conteúdo do áudio é inválido.");
  }

  if (payload.audioBase64.length === 0) {
    throw new Error("O áudio está vazio.");
  }

  if (payload.audioBase64.length > MAX_BASE64_LENGTH) {
    throw new Error("Este trecho de áudio excede o limite permitido.");
  }
}

function base64ToArrayBuffer(base64) {
  let binary;

  try {
    binary = atob(base64);
  } catch {
    throw new Error("Não foi possível preparar o áudio para transcrição.");
  }

  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer;
}

function decodePcm16Wav(buffer) {
  const view = new DataView(buffer);

  if (view.byteLength < 44 || readAscii(view, 0, 4) !== "RIFF" || readAscii(view, 8, 4) !== "WAVE") {
    throw new Error("O áudio convertido não é um WAV válido.");
  }

  let offset = 12;
  let format = null;
  let dataOffset = null;
  let dataLength = null;

  while (offset + 8 <= view.byteLength) {
    const chunkId = readAscii(view, offset, 4);
    const chunkLength = view.getUint32(offset + 4, true);
    const chunkDataOffset = offset + 8;

    if (chunkDataOffset + chunkLength > view.byteLength) {
      throw new Error("O arquivo WAV está truncado.");
    }

    if (chunkId === "fmt ") {
      format = {
        encoding: view.getUint16(chunkDataOffset, true),
        channels: view.getUint16(chunkDataOffset + 2, true),
        sampleRate: view.getUint32(chunkDataOffset + 4, true),
        bitsPerSample: view.getUint16(chunkDataOffset + 14, true),
      };
    } else if (chunkId === "data") {
      dataOffset = chunkDataOffset;
      dataLength = chunkLength;
    }

    offset = chunkDataOffset + chunkLength + (chunkLength % 2);
  }

  if (!format || dataOffset === null || dataLength === null) {
    throw new Error("O WAV não contém os dados de áudio esperados.");
  }

  if (format.encoding !== 1 || format.channels !== 1 || format.bitsPerSample !== 16) {
    throw new Error("O formato PCM do áudio convertido não é compatível.");
  }

  const sampleCount = Math.floor(dataLength / 2);
  const samples = new Float32Array(sampleCount);

  for (let index = 0; index < sampleCount; index += 1) {
    const pcm = view.getInt16(dataOffset + index * 2, true);
    samples[index] = pcm < 0 ? pcm / 0x8000 : pcm / 0x7fff;
  }

  return { samples, sampleRate: format.sampleRate };
}

function readAscii(view, offset, length) {
  let value = "";
  for (let index = 0; index < length; index += 1) {
    value += String.fromCharCode(view.getUint8(offset + index));
  }
  return value;
}

function normalizeError(error) {
  const message = error instanceof Error ? error.message : String(error || "");

  if (/memory|allocation|out of bounds/i.test(message)) {
    return "O Chrome ficou sem memória para executar a IA local. Feche abas pesadas e tente novamente.";
  }

  if (/local file|locate file|model|onnx|backend/i.test(message)) {
    return "Não foi possível carregar o modelo local. Reinstale a extensão a partir do pacote completo.";
  }

  return message || "Ocorreu um erro inesperado durante a transcrição local.";
}

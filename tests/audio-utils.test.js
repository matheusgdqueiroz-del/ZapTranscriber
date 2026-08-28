const test = require("node:test");
const assert = require("node:assert/strict");
const {
  WAV_HEADER_SIZE,
  downmixChannels,
  resampleLinear,
  encodePcm16Wav,
  splitSamples,
  dataUrlToBlob,
  createDecodingContext,
} = require("../lib/audio-utils.js");
const transcriptCleanup = import("../src/lib/transcript-cleanup.mjs");
const runtimeConfig = import("../src/lib/runtime-config.mjs");

test("downmixChannels calcula a média dos canais", () => {
  const mono = downmixChannels([
    new Float32Array([1, 0.5, -1]),
    new Float32Array([-1, 0.5, 1]),
  ]);

  assert.deepEqual(Array.from(mono), [0, 0.5, 0]);
});

test("resampleLinear reduz o número de amostras", () => {
  const output = resampleLinear(new Float32Array([0, 0.25, 0.5, 0.75]), 4, 2);

  assert.deepEqual(Array.from(output), [0, 0.5]);
});

test("encodePcm16Wav produz um cabeçalho WAV PCM mono válido", () => {
  const output = encodePcm16Wav(new Float32Array([-1, 0, 1]), 16000);
  const view = new DataView(output);
  const ascii = (start, length) =>
    String.fromCharCode(...new Uint8Array(output, start, length));

  assert.equal(output.byteLength, WAV_HEADER_SIZE + 6);
  assert.equal(ascii(0, 4), "RIFF");
  assert.equal(ascii(8, 4), "WAVE");
  assert.equal(ascii(36, 4), "data");
  assert.equal(view.getUint16(22, true), 1);
  assert.equal(view.getUint32(24, true), 16000);
  assert.equal(view.getInt16(44, true), -32768);
  assert.equal(view.getInt16(46, true), 0);
  assert.equal(view.getInt16(48, true), 32767);
});

test("splitSamples preserva todas as amostras em múltiplos trechos", () => {
  const chunks = splitSamples(new Float32Array([1, 2, 3, 4, 5]), 2);

  assert.deepEqual(chunks.map((chunk) => Array.from(chunk)), [[1, 2], [3, 4], [5]]);
});

test("dataUrlToBlob reconstrói o áudio recebido da página", async () => {
  const blob = dataUrlToBlob("data:audio/ogg;base64,AQIDBA==");

  assert.equal(blob.type, "audio/ogg");
  assert.deepEqual(Array.from(new Uint8Array(await blob.arrayBuffer())), [1, 2, 3, 4]);
});

test("createDecodingContext solicita decodificação diretamente em 16 kHz", () => {
  class FakeAudioContext {
    constructor(options) {
      this.options = options;
    }
  }

  const context = createDecodingContext(FakeAudioContext, 16000);

  assert.deepEqual(context.options, { sampleRate: 16000 });
});

test("selectWasmThreadCount usa múltiplos núcleos sem saturar o processador", async () => {
  const { selectWasmThreadCount } = await runtimeConfig;

  assert.equal(selectWasmThreadCount(true, 12), 4);
  assert.equal(selectWasmThreadCount(true, 4), 2);
  assert.equal(selectWasmThreadCount(true, 2), 1);
});

test("selectWasmThreadCount mantém compatibilidade sem isolamento", async () => {
  const { selectWasmThreadCount } = await runtimeConfig;

  assert.equal(selectWasmThreadCount(false, 12), 1);
});

test("cleanTranscript limita uma palavra repetida em sequência", async () => {
  const { cleanTranscript } = await transcriptCleanup;

  assert.equal(cleanTranscript("sim sim sim sim sim, pode enviar"), "sim sim pode enviar");
});

test("cleanTranscript remove loops de frases sem alterar o restante", async () => {
  const { cleanTranscript } = await transcriptCleanup;

  assert.equal(
    cleanTranscript(
      "Obrigado por assistir. Obrigado por assistir. Obrigado por assistir. Até amanhã."
    ),
    "Obrigado por assistir. Até amanhã."
  );
});

test("cleanTranscript preserva repetições naturais curtas", async () => {
  const { cleanTranscript } = await transcriptCleanup;

  assert.equal(cleanTranscript("Não, não precisa repetir."), "Não, não precisa repetir.");
});

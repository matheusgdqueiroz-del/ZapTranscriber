(function exposeAudioUtils(globalScope) {
  const WAV_HEADER_SIZE = 44;

  function downmixChannels(channels) {
    if (!Array.isArray(channels) || channels.length === 0) {
      throw new TypeError("Ao menos um canal de áudio é necessário.");
    }

    const length = channels[0].length;
    const mono = new Float32Array(length);

    for (const channel of channels) {
      if (!(channel instanceof Float32Array) || channel.length !== length) {
        throw new TypeError("Os canais de áudio precisam ter o mesmo tamanho.");
      }

      for (let index = 0; index < length; index += 1) {
        mono[index] += channel[index] / channels.length;
      }
    }

    return mono;
  }

  function resampleLinear(samples, inputRate, outputRate) {
    if (!(samples instanceof Float32Array)) {
      throw new TypeError("As amostras devem ser um Float32Array.");
    }

    if (inputRate <= 0 || outputRate <= 0) {
      throw new RangeError("As taxas de amostragem devem ser positivas.");
    }

    if (samples.length === 0 || inputRate === outputRate) {
      return samples.slice();
    }

    const outputLength = Math.max(
      1,
      Math.round(samples.length * (outputRate / inputRate))
    );
    const output = new Float32Array(outputLength);
    const scale = inputRate / outputRate;

    for (let index = 0; index < outputLength; index += 1) {
      const sourcePosition = index * scale;
      const leftIndex = Math.min(Math.floor(sourcePosition), samples.length - 1);
      const rightIndex = Math.min(leftIndex + 1, samples.length - 1);
      const weight = sourcePosition - leftIndex;
      output[index] =
        samples[leftIndex] * (1 - weight) + samples[rightIndex] * weight;
    }

    return output;
  }

  function encodePcm16Wav(samples, sampleRate) {
    if (!(samples instanceof Float32Array)) {
      throw new TypeError("As amostras devem ser um Float32Array.");
    }

    if (!Number.isInteger(sampleRate) || sampleRate <= 0) {
      throw new RangeError("A taxa de amostragem é inválida.");
    }

    const buffer = new ArrayBuffer(WAV_HEADER_SIZE + samples.length * 2);
    const view = new DataView(buffer);

    writeAscii(view, 0, "RIFF");
    view.setUint32(4, 36 + samples.length * 2, true);
    writeAscii(view, 8, "WAVE");
    writeAscii(view, 12, "fmt ");
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);
    view.setUint16(22, 1, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);
    writeAscii(view, 36, "data");
    view.setUint32(40, samples.length * 2, true);

    let offset = WAV_HEADER_SIZE;
    for (let index = 0; index < samples.length; index += 1) {
      const clamped = Math.max(-1, Math.min(1, samples[index]));
      const pcm = clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff;
      view.setInt16(offset, Math.round(pcm), true);
      offset += 2;
    }

    return buffer;
  }

  function splitSamples(samples, maxSamplesPerChunk) {
    if (!(samples instanceof Float32Array)) {
      throw new TypeError("As amostras devem ser um Float32Array.");
    }

    if (!Number.isInteger(maxSamplesPerChunk) || maxSamplesPerChunk <= 0) {
      throw new RangeError("O tamanho máximo do trecho é inválido.");
    }

    const chunks = [];
    for (let offset = 0; offset < samples.length; offset += maxSamplesPerChunk) {
      chunks.push(samples.slice(offset, offset + maxSamplesPerChunk));
    }

    return chunks;
  }

  async function prepareAudioChunks(
    audioBlob,
    { sampleRate = 16000, maxDurationSeconds = 300 } = {}
  ) {
    if (!(audioBlob instanceof Blob)) {
      throw new TypeError("O arquivo de áudio é inválido.");
    }

    const AudioContextClass = globalScope.AudioContext || globalScope.webkitAudioContext;
    if (!AudioContextClass) {
      throw new Error("Seu navegador não oferece suporte à conversão de áudio.");
    }

    const context = createDecodingContext(AudioContextClass, sampleRate);
    let decoded;

    try {
      const source = await audioBlob.arrayBuffer();
      decoded = await context.decodeAudioData(source.slice(0));
    } finally {
      await context.close().catch(() => {});
    }

    const channels = [];
    for (let index = 0; index < decoded.numberOfChannels; index += 1) {
      channels.push(decoded.getChannelData(index));
    }

    const mono = downmixChannels(channels);
    const resampled = resampleLinear(mono, decoded.sampleRate, sampleRate);
    const chunkLength = Math.floor(sampleRate * maxDurationSeconds);
    const chunks = splitSamples(resampled, chunkLength);

    return chunks.map((chunk, index) => ({
      blob: new Blob([encodePcm16Wav(chunk, sampleRate)], { type: "audio/wav" }),
      fileName: `whatsapp-audio-${String(index + 1).padStart(2, "0")}.wav`,
      durationSeconds: chunk.length / sampleRate,
    }));
  }

  function createDecodingContext(AudioContextClass, sampleRate) {
    try {
      return new AudioContextClass({ sampleRate });
    } catch {
      return new AudioContextClass();
    }
  }

  function blobToBase64(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Não foi possível ler o áudio convertido."));
      reader.onload = () => {
        const result = String(reader.result || "");
        const separator = result.indexOf(",");

        if (separator < 0) {
          reject(new Error("O áudio convertido ficou inválido."));
          return;
        }

        resolve(result.slice(separator + 1));
      };
      reader.readAsDataURL(blob);
    });
  }

  function dataUrlToBlob(dataUrl) {
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
      throw new TypeError("O áudio recebido do WhatsApp é inválido.");
    }

    const separator = dataUrl.indexOf(",");
    if (separator < 0) {
      throw new TypeError("O áudio recebido do WhatsApp é inválido.");
    }

    const metadata = dataUrl.slice(5, separator);
    const encoded = dataUrl.slice(separator + 1);
    const isBase64 = /;base64(?:;|$)/i.test(metadata);
    const mimeType = metadata.split(";")[0] || "application/octet-stream";
    const binary = isBase64 ? globalScope.atob(encoded) : decodeURIComponent(encoded);
    const bytes = new Uint8Array(binary.length);

    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }

    return new Blob([bytes], { type: mimeType });
  }

  function writeAscii(view, offset, text) {
    for (let index = 0; index < text.length; index += 1) {
      view.setUint8(offset + index, text.charCodeAt(index));
    }
  }

  const api = {
    WAV_HEADER_SIZE,
    downmixChannels,
    resampleLinear,
    encodePcm16Wav,
    splitSamples,
    prepareAudioChunks,
    blobToBase64,
    dataUrlToBlob,
    createDecodingContext,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    globalScope.ZapAudio = api;
  }
})(typeof globalThis !== "undefined" ? globalThis : window);

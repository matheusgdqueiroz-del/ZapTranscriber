(function initializeZapTranscriber() {
  const AUDIO_SELECTOR = "audio";
  const VOICE_CONTROL_SELECTOR = [
    'button[aria-label*="mensagem de voz" i]',
    'button[aria-label*="voice message" i]',
    'button[aria-label*="mensaje de voz" i]',
    'button[aria-label*="message vocal" i]',
    'button[aria-label*="Sprachnachricht" i]',
  ].join(",");
  const VOICE_MESSAGE_LABEL =
    /(?:mensagem de voz|voice message|mensaje de voz|message vocal|Sprachnachricht)/i;
  const VOICE_ACTION_LABEL =
    /(?:reproduzir|pausar|play|pause|reproducir|lire|abspielen|anhalten)/i;
  const MEDIA_CHANNEL = "zap-transcriber";
  const MEDIA_REQUEST_TYPE = "ZAP_TRANSCRIBER_MEDIA_REQUEST";
  const MEDIA_RESPONSE_TYPE = "ZAP_TRANSCRIBER_MEDIA_RESPONSE";
  const MEDIA_TIMEOUT_MS = 45000;
  const MAX_CHUNK_DURATION_SECONDS = 300;
  const processedSources = new WeakMap();
  const activeRequests = new Map();
  let scanScheduled = false;

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type !== "ZAP_TRANSCRIPTION_PROGRESS") {
      return;
    }

    const active = activeRequests.get(message.requestId);
    if (active?.button && message.progress?.label) {
      setButtonState(active.button, "busy", message.progress.label);
    }
  });

  function scheduleScan() {
    if (scanScheduled) {
      return;
    }

    scanScheduled = true;
    window.requestAnimationFrame(() => {
      scanScheduled = false;
      scanForAudioMessages();
    });
  }

  function scanForAudioMessages() {
    document.querySelectorAll(VOICE_CONTROL_SELECTOR).forEach(attachCurrentPlayer);
    document.querySelectorAll(AUDIO_SELECTOR).forEach(attachLegacyPlayer);
  }

  function attachCurrentPlayer(control) {
    const label = control.getAttribute("aria-label") || "";
    if (!VOICE_MESSAGE_LABEL.test(label) || !VOICE_ACTION_LABEL.test(label)) {
      return;
    }

    const message = findMessageContainer(control);
    const messageId = message?.getAttribute("data-id") || "";
    if (!message || !messageId) {
      return;
    }

    const existing = processedSources.get(message);
    if (existing?.wrapper?.isConnected) {
      return;
    }

    const anchor = control.closest('[data-testid="msg-container"]') || findInjectionAnchor(control);
    attachTranscriber(message, anchor, { kind: "whatsapp-message", messageId });
  }

  function attachLegacyPlayer(audio) {
    if (!(audio instanceof HTMLAudioElement)) {
      return;
    }

    const message = findMessageContainer(audio);
    const sourceElement = message || audio;
    const existing = processedSources.get(sourceElement);
    if (existing?.wrapper?.isConnected) {
      return;
    }

    const anchor = findInjectionAnchor(audio);
    attachTranscriber(sourceElement, anchor, { kind: "legacy-audio", audio });
  }

  function attachTranscriber(sourceElement, anchor, source) {
    if (!anchor?.parentElement) {
      return;
    }

    const ui = buildTranscriberUi(source);
    anchor.insertAdjacentElement("afterend", ui.wrapper);
    processedSources.set(sourceElement, ui);
  }

  function findInjectionAnchor(audio) {
    const knownPlayer = audio.closest(
      '[data-testid*="audio"], [data-testid*="voice"], [role="group"]'
    );

    if (knownPlayer && findMessageContainer(knownPlayer)) {
      return knownPlayer;
    }

    let current = audio.parentElement;
    const message = findMessageContainer(audio);

    for (let depth = 0; current && current !== message && depth < 4; depth += 1) {
      if (current.parentElement === message) {
        return current;
      }
      current = current.parentElement;
    }

    return audio.parentElement || audio;
  }

  function findMessageContainer(element) {
    return (
      element.closest('[data-testid^="conv-msg-"][data-id]') ||
      element.closest("[data-id]") ||
      element.closest('[role="row"]') ||
      element.closest(".message-in, .message-out")
    );
  }

  function buildTranscriberUi(source) {
    const wrapper = document.createElement("div");
    wrapper.className = "zap-transcriber";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "zap-transcriber__button";
    button.setAttribute("aria-label", "Transcrever esta mensagem de voz");
    button.innerHTML = `${transcriptIcon()}<span>Transcrever</span>`;

    const panel = document.createElement("div");
    panel.className = "zap-transcriber__panel";
    panel.hidden = true;
    panel.setAttribute("aria-live", "polite");

    wrapper.append(button, panel);

    button.addEventListener("click", () => runTranscription({ source, button, panel }));

    return { wrapper, button, panel };
  }

  async function runTranscription({ source, button, panel }) {
    const requestId = createRequestId();
    activeRequests.set(requestId, { button });
    setButtonState(button, "busy", "Preparando áudio…");
    hidePanel(panel);

    try {
      const sourceBlob = await getSourceBlob(source);
      if (sourceBlob.size === 0) {
        throw new Error("O WhatsApp retornou um arquivo de áudio vazio.");
      }

      const chunks = await window.ZapAudio.prepareAudioChunks(sourceBlob, {
        sampleRate: 16000,
        maxDurationSeconds: MAX_CHUNK_DURATION_SECONDS,
      });

      if (chunks.length === 0) {
        throw new Error("Não foi possível encontrar fala nesta mensagem.");
      }

      const transcripts = [];

      for (let index = 0; index < chunks.length; index += 1) {
        const progress =
          chunks.length === 1
            ? "Transcrevendo…"
            : `Transcrevendo ${index + 1}/${chunks.length}…`;
        setButtonState(button, "busy", progress);

        const audioBase64 = await window.ZapAudio.blobToBase64(chunks[index].blob);
        const responseMessage = await chrome.runtime.sendMessage({
          type: "ZAP_TRANSCRIBE_AUDIO",
          requestId,
          payload: {
            audioBase64,
            fileName: chunks[index].fileName,
          },
        });

        if (!responseMessage?.ok) {
          throw new Error(
            responseMessage?.error || "A extensão não conseguiu concluir a transcrição."
          );
        }

        transcripts.push(responseMessage.result.text);
      }

      const transcript = transcripts.filter(Boolean).join("\n\n");
      showTranscript(panel, transcript);
      setButtonState(button, "ready", "Transcrever novamente");
    } catch (error) {
      showError(panel, friendlyError(error));
      setButtonState(button, "ready", "Tentar novamente");
    } finally {
      activeRequests.delete(requestId);
    }
  }

  async function getSourceBlob(source) {
    if (source.kind === "whatsapp-message") {
      const dataUrl = await requestWhatsAppMedia(source.messageId);
      return window.ZapAudio.dataUrlToBlob(dataUrl);
    }

    const sourceUrl = source.audio.currentSrc || source.audio.src;
    if (!sourceUrl) {
      throw new Error(
        "O áudio ainda não foi carregado. Reproduza um instante da mensagem e tente novamente."
      );
    }

    const response = await fetch(sourceUrl, { credentials: "include" });
    if (!response.ok) {
      throw new Error("Não foi possível baixar esta mensagem de voz do WhatsApp.");
    }

    return response.blob();
  }

  function requestWhatsAppMedia(messageId) {
    const requestId = createRequestId();

    return new Promise((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "O WhatsApp demorou para disponibilizar este áudio. Recarregue a página e tente novamente."
          )
        );
      }, MEDIA_TIMEOUT_MS);

      function cleanup() {
        window.clearTimeout(timeout);
        window.removeEventListener("message", handleResponse);
      }

      function handleResponse(event) {
        const response = event.data;
        if (
          event.source !== window ||
          event.origin !== window.location.origin ||
          response?.channel !== MEDIA_CHANNEL ||
          response?.type !== MEDIA_RESPONSE_TYPE ||
          response?.requestId !== requestId
        ) {
          return;
        }

        cleanup();
        if (!response.ok) {
          reject(new Error(response.error || "Não foi possível obter este áudio do WhatsApp."));
          return;
        }

        resolve(response.dataUrl);
      }

      window.addEventListener("message", handleResponse);
      window.postMessage(
        {
          channel: MEDIA_CHANNEL,
          type: MEDIA_REQUEST_TYPE,
          requestId,
          messageId,
        },
        window.location.origin
      );
    });
  }

  function showTranscript(panel, transcript) {
    panel.replaceChildren();
    panel.hidden = false;
    panel.classList.remove("zap-transcriber__panel--error");

    const heading = document.createElement("div");
    heading.className = "zap-transcriber__heading";
    heading.textContent = "Transcrição";

    const text = document.createElement("p");
    text.className = "zap-transcriber__text";
    text.textContent = transcript || "Nenhuma fala foi identificada.";

    const copy = document.createElement("button");
    copy.type = "button";
    copy.className = "zap-transcriber__copy";
    copy.textContent = "Copiar texto";
    copy.addEventListener("click", async () => {
      try {
        await copyText(text.textContent);
        copy.textContent = "Copiado!";
        window.setTimeout(() => {
          copy.textContent = "Copiar texto";
        }, 1600);
      } catch {
        copy.textContent = "Não foi possível copiar";
      }
    });

    panel.append(heading, text, copy);
  }

  function showError(panel, message) {
    panel.replaceChildren();
    panel.hidden = false;
    panel.classList.add("zap-transcriber__panel--error");

    const heading = document.createElement("div");
    heading.className = "zap-transcriber__heading";
    heading.textContent = "Não foi possível transcrever";

    const text = document.createElement("p");
    text.className = "zap-transcriber__text";
    text.textContent = message;

    panel.append(heading, text);
  }

  function hidePanel(panel) {
    panel.hidden = true;
    panel.replaceChildren();
  }

  function setButtonState(button, state, label) {
    button.disabled = state === "busy";
    button.classList.toggle("zap-transcriber__button--busy", state === "busy");
    const labelElement = button.querySelector("span");

    if (labelElement) {
      labelElement.textContent = label;
    }
  }

  function friendlyError(error) {
    if (error instanceof Error && error.message) {
      if (/EncodingError|decodeAudioData|audio codec|formato de áudio/i.test(error.message)) {
        return "O formato desta mensagem não pôde ser convertido. Tente reproduzir o áudio inteiro e tente novamente.";
      }
      return error.message;
    }

    return "Ocorreu um erro inesperado. Tente novamente.";
  }

  function createRequestId() {
    if (crypto.randomUUID) {
      return crypto.randomUUID();
    }

    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      try {
        await Promise.race([
          navigator.clipboard.writeText(text),
          new Promise((_, reject) => {
            window.setTimeout(() => reject(new Error("A área de transferência não respondeu")), 1200);
          }),
        ]);
        return;
      } catch {
        // Navegadores que bloqueiam a API moderna ainda podem permitir execCommand.
      }
    }

    const area = document.createElement("textarea");
    area.value = text;
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();

    if (!copied) {
      throw new Error("Falha ao copiar");
    }
  }

  function transcriptIcon() {
    return `
      <svg aria-hidden="true" viewBox="0 0 24 24" width="15" height="15" fill="none">
        <path d="M5 9v6M9 6v12M13 4v16M17 7v10M21 10v4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `;
  }

  const observer = new MutationObserver(scheduleScan);
  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src", "aria-label", "data-id"],
  });

  scheduleScan();
})();

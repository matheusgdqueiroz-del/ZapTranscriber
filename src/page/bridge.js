(function initializeWhatsAppMediaBridge() {
  const CHANNEL = "zap-transcriber";
  const REQUEST_TYPE = "ZAP_TRANSCRIBER_MEDIA_REQUEST";
  const RESPONSE_TYPE = "ZAP_TRANSCRIBER_MEDIA_RESPONSE";
  const READY_TIMEOUT_MS = 30000;
  const activeRequests = new Set();

  window.addEventListener("message", (event) => {
    const message = event.data;

    if (
      event.source !== window ||
      event.origin !== window.location.origin ||
      message?.channel !== CHANNEL ||
      message?.type !== REQUEST_TYPE ||
      !isSafeRequestId(message.requestId) ||
      !isSafeMessageId(message.messageId) ||
      activeRequests.has(message.requestId)
    ) {
      return;
    }

    activeRequests.add(message.requestId);
    provideMedia(message.requestId, message.messageId).finally(() => {
      activeRequests.delete(message.requestId);
    });
  });

  async function provideMedia(requestId, messageId) {
    try {
      const wpp = await waitForWpp();
      const message = findMessageModel(wpp, messageId);

      if (!message) {
        throw new Error(
          "O WhatsApp ainda não disponibilizou este áudio. Role a conversa até a mensagem e tente novamente."
        );
      }

      const serializedId = getSerializedMessageId(message);
      if (!serializedId) {
        throw new Error("Não foi possível identificar esta mensagem de voz.");
      }

      const blob = await wpp.chat.downloadMedia(serializedId);
      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("O WhatsApp retornou um arquivo de áudio vazio.");
      }

      const dataUrl = await blobToDataUrl(blob);
      postResponse(requestId, {
        ok: true,
        dataUrl,
      });
    } catch (error) {
      postResponse(requestId, {
        ok: false,
        error: friendlyBridgeError(error),
      });
    }
  }

  async function waitForWpp() {
    const deadline = Date.now() + READY_TIMEOUT_MS;

    while (Date.now() < deadline) {
      const wpp = window.WPP;
      if (
        wpp?.loader?.isReady &&
        typeof wpp.chat?.downloadMedia === "function" &&
        wpp.whatsapp?.MsgStore
      ) {
        return wpp;
      }

      await delay(200);
    }

    throw new Error(
      "A integração local com o WhatsApp não ficou pronta. Recarregue a página e tente novamente."
    );
  }

  function findMessageModel(wpp, messageId) {
    const store = wpp.whatsapp.MsgStore;
    const directMatch = typeof store.get === "function" ? store.get(messageId) : undefined;

    if (getDomMessageId(directMatch) === messageId) {
      return directMatch;
    }

    const models =
      (typeof store.getModelsArray === "function" && store.getModelsArray()) ||
      (typeof store.toArray === "function" && store.toArray()) ||
      [];

    return models.find((model) => getDomMessageId(model) === messageId);
  }

  function getDomMessageId(message) {
    return String(message?.id?.id || "");
  }

  function getSerializedMessageId(message) {
    const id = message?.id;

    if (typeof id === "string") {
      return id;
    }

    if (typeof id?._serialized === "string") {
      return id._serialized;
    }

    const stringValue = typeof id?.toString === "function" ? String(id.toString()) : "";
    return stringValue && stringValue !== "[object Object]" ? stringValue : "";
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error("Não foi possível ler o áudio do WhatsApp."));
      reader.onload = () => resolve(String(reader.result || ""));
      reader.readAsDataURL(blob);
    });
  }

  function postResponse(requestId, payload) {
    window.postMessage(
      {
        channel: CHANNEL,
        type: RESPONSE_TYPE,
        requestId,
        ...payload,
      },
      window.location.origin
    );
  }

  function isSafeRequestId(value) {
    return typeof value === "string" && value.length >= 8 && value.length <= 100;
  }

  function isSafeMessageId(value) {
    return typeof value === "string" && /^[A-Za-z0-9._-]{8,200}$/.test(value);
  }

  function friendlyBridgeError(error) {
    if (error instanceof Error && error.message) {
      return error.message;
    }

    return "Não foi possível obter este áudio do WhatsApp.";
  }

  function delay(milliseconds) {
    return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
  }
})();

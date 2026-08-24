const OFFSCREEN_DOCUMENT_PATH = "offscreen/offscreen.html";
let creatingOffscreenDocument = null;

chrome.runtime.onInstalled.addListener(async () => {
  const current = await chrome.storage.local.get(["language"]);

  if (typeof current.language !== "string") {
    await chrome.storage.local.set({ language: "pt" });
  }

  await chrome.storage.local.remove(["apiKey", "contextPrompt"]);
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message?.type === "ZAP_OFFSCREEN_PROGRESS" && message.target === "background") {
    forwardProgress(message);
    return false;
  }

  if (message?.type !== "ZAP_TRANSCRIBE_AUDIO" || message.target === "offscreen") {
    return false;
  }

  forwardTranscription(message, sender)
    .then(sendResponse)
    .catch((error) => {
      console.error("[ZapTranscriber] Falha ao acionar a IA local", error);
      sendResponse({
        ok: false,
        error: error instanceof Error ? error.message : "Falha ao iniciar a IA local.",
      });
    });

  return true;
});

async function forwardTranscription(message, sender) {
  await ensureOffscreenDocument();
  const { language = "pt" } = await chrome.storage.local.get(["language"]);

  return chrome.runtime.sendMessage({
    ...message,
    target: "offscreen",
    tabId: sender.tab?.id,
    language,
  });
}

async function ensureOffscreenDocument() {
  const offscreenUrl = chrome.runtime.getURL(OFFSCREEN_DOCUMENT_PATH);
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ["OFFSCREEN_DOCUMENT"],
    documentUrls: [offscreenUrl],
  });

  if (existingContexts.length > 0) {
    return;
  }

  if (!creatingOffscreenDocument) {
    creatingOffscreenDocument = chrome.offscreen
      .createDocument({
        url: OFFSCREEN_DOCUMENT_PATH,
        reasons: ["WORKERS"],
        justification: "Executar o modelo Whisper local com WebAssembly.",
      })
      .finally(() => {
        creatingOffscreenDocument = null;
      });
  }

  await creatingOffscreenDocument;
}

function forwardProgress(message) {
  if (!Number.isInteger(message.tabId) || !message.requestId) {
    return;
  }

  chrome.tabs
    .sendMessage(message.tabId, {
      type: "ZAP_TRANSCRIPTION_PROGRESS",
      requestId: message.requestId,
      progress: message.progress,
    })
    .catch(() => {});
}

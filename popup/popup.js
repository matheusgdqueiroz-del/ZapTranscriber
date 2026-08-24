const form = document.querySelector("#settings-form");
const languageInput = document.querySelector("#language");
const statusElement = document.querySelector("#status");

loadSettings();

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  setStatus("Salvando…");

  try {
    await chrome.storage.local.set({
      language: languageInput.value,
    });
    setStatus("Configurações salvas.");
  } catch {
    setStatus("Não foi possível salvar as configurações.", true);
  }
});

async function loadSettings() {
  try {
    const settings = await chrome.storage.local.get(["language"]);
    languageInput.value = settings.language || "pt";
  } catch {
    setStatus("Não foi possível carregar as configurações.", true);
  }
}

function setStatus(message, isError = false) {
  statusElement.textContent = message;
  statusElement.classList.toggle("status--error", isError);
}

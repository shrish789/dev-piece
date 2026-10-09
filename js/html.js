const htmlInput = document.getElementById("html-input");
const htmlPreview = document.getElementById("html-preview");
const htmlLive = document.getElementById("html-live");
const htmlStatus = document.getElementById("html-status");
const renderHtmlButton = document.getElementById("render-html");
const clearHtmlButton = document.getElementById("html-clear");
const htmlDraftKey = "html-draft-v1";
let htmlRenderTimer;
let htmlSaveTimer;

const previewPolicy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'none'; connect-src 'none'; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; style-src 'unsafe-inline' https: http:; img-src data: blob: https: http:; font-src data: https: http:; media-src data: blob: https: http:">`;

function buildPreviewDocument(source) {
  if (/<head(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<head((?:\s[^>]*)?)>/i, `<head$1>${previewPolicy}`);
  }
  if (/<html(?:\s[^>]*)?>/i.test(source)) {
    return source.replace(/<html((?:\s[^>]*)?)>/i, `<html$1><head>${previewPolicy}</head>`);
  }
  const fragment = source.replace(/^\s*<!doctype[^>]*>/i, "");
  return `<!doctype html><html><head>${previewPolicy}</head><body>${fragment}</body></html>`;
}

function setHtmlStatus(message, isError = false) {
  htmlStatus.textContent = message;
  htmlStatus.className = isError ? "status error" : "status";
}

function updateHtmlActions() {
  const isEmpty = htmlInput.value === "";
  renderHtmlButton.disabled = isEmpty;
  clearHtmlButton.disabled = isEmpty;
}

function renderHtml() {
  clearTimeout(htmlRenderTimer);
  htmlPreview.srcdoc = buildPreviewDocument(htmlInput.value);
  setHtmlStatus(htmlInput.value.trim()
    ? "Preview updated; scripts are blocked"
    : "Preview ready; scripts are blocked");
}

function saveHtmlDraft() {
  clearTimeout(htmlSaveTimer);
  try {
    localStorage.setItem(htmlDraftKey, JSON.stringify({
      text: htmlInput.value,
      live: htmlLive.checked
    }));
  } catch {
    setHtmlStatus("Preview works, but this draft could not be saved", true);
  }
}

function scheduleHtmlSave() {
  clearTimeout(htmlSaveTimer);
  htmlSaveTimer = setTimeout(saveHtmlDraft, 250);
}

function scheduleHtmlRender() {
  clearTimeout(htmlRenderTimer);
  setHtmlStatus("Updating preview…");
  htmlRenderTimer = setTimeout(renderHtml, 160);
}

try {
  const saved = JSON.parse(localStorage.getItem(htmlDraftKey) || "null");
  if (saved && typeof saved.text === "string") {
    htmlInput.value = saved.text;
    htmlLive.checked = saved.live !== false;
  }
} catch {
  setHtmlStatus("Saved HTML draft could not be loaded", true);
}

htmlInput.addEventListener("input", () => {
  updateHtmlActions();
  scheduleHtmlSave();
  if (htmlLive.checked) scheduleHtmlRender();
  else setHtmlStatus("Changes are waiting; choose Render to update the preview");
});

htmlLive.addEventListener("change", () => {
  saveHtmlDraft();
  if (htmlLive.checked) renderHtml();
  else setHtmlStatus("Live preview paused; scripts remain blocked");
});

renderHtmlButton.addEventListener("click", renderHtml);
clearHtmlButton.addEventListener("click", () => {
  if (htmlInput.value && !window.confirm("Clear the HTML draft saved in this browser?")) return;
  clearTimeout(htmlRenderTimer);
  clearTimeout(htmlSaveTimer);
  htmlInput.value = "";
  updateHtmlActions();
  renderHtml();
  saveHtmlDraft();
  htmlInput.focus();
});

window.addEventListener("pagehide", saveHtmlDraft);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveHtmlDraft();
});

updateHtmlActions();
renderHtml();

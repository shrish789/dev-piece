const markdownInput = document.getElementById("markdown-input");
const markdownPreview = document.getElementById("markdown-preview");
let scrollSource = null;
let scrollSyncToken = 0;
const markdownStatus = document.getElementById("markdown-status");
const draftKey = "markdown-draft-v1";
let saveTimer;
let restoredScroll = null;
let lastScrollRatio = 0;

function saveMarkdownDraft() {
  clearTimeout(saveTimer);
  if (markdownInput.clientHeight) lastScrollRatio = scrollRatio(markdownInput);
  try {
    localStorage.setItem(draftKey, JSON.stringify({
      text: markdownInput.value,
      start: markdownInput.selectionStart,
      end: markdownInput.selectionEnd,
      scroll: restoredScroll ?? lastScrollRatio
    }));
    markdownStatus.textContent = "Draft saved in this browser";
    markdownStatus.className = "status";
  } catch {
    markdownStatus.textContent = "Draft could not be saved; browser storage is unavailable or full";
    markdownStatus.className = "status error";
  }
}

function scheduleDraftSave(announce = true) {
  clearTimeout(saveTimer);
  if (announce) markdownStatus.textContent = "Saving draft…";
  saveTimer = setTimeout(saveMarkdownDraft, 250);
}

function scheduleScrollSave() {
  lastScrollRatio = scrollRatio(markdownInput);
  scheduleDraftSave(false);
}

try {
  const saved = JSON.parse(localStorage.getItem(draftKey) || "null");
  if (saved && typeof saved.text === "string") {
    markdownInput.value = saved.text;
    if (Number.isInteger(saved.start) && Number.isInteger(saved.end)) {
      markdownInput.setSelectionRange(saved.start, saved.end);
    }
    restoredScroll = Number.isFinite(saved.scroll) ? Math.max(0, Math.min(1, saved.scroll)) : 0;
    markdownStatus.textContent = "Draft restored from this browser";
  }
} catch {
  markdownStatus.textContent = "Saved draft could not be loaded";
  markdownStatus.className = "status error";
}

function restoreDraftScroll() {
  if (restoredScroll === null || !markdownInput.clientHeight) return;
  lastScrollRatio = restoredScroll;
  applyScrollRatio(markdownInput, restoredScroll);
  applyScrollRatio(markdownPreview, restoredScroll);
  restoredScroll = null;
}
new ResizeObserver(restoreDraftScroll).observe(markdownInput);
window.addEventListener("hashchange", () => requestAnimationFrame(restoreDraftScroll));
window.addEventListener("pagehide", saveMarkdownDraft);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") saveMarkdownDraft();
});
markdownInput.addEventListener("input", () => {
  restoredScroll = null;
  scheduleDraftSave();
});
markdownInput.addEventListener("select", scheduleDraftSave);
markdownInput.addEventListener("scroll", scheduleScrollSave);
document.getElementById("markdown-clear").addEventListener("click", () => {
  if (markdownInput.value && !window.confirm("Clear the Markdown draft saved in this browser?")) return;
  clearTimeout(saveTimer);
  markdownInput.value = "";
  lastScrollRatio = 0;
  markdownInput.scrollTop = 0;
  restoredScroll = null;
  renderMarkdown();
  saveMarkdownDraft();
  markdownInput.focus();
});

function scrollRatio(element) {
  const range = element.scrollHeight - element.clientHeight;
  return range > 0 ? element.scrollTop / range : 0;
}

function applyScrollRatio(element, ratio) {
  const range = element.scrollHeight - element.clientHeight;
  element.scrollTop = range > 0 ? ratio * range : 0;
}

function renderMarkdown() {
  const raw = marked.parse(markdownInput.value);
  markdownPreview.innerHTML = DOMPurify.sanitize(raw);
  for (const code of markdownPreview.querySelectorAll("pre code")) {
    const declaredLanguage = code.className.match(/(?:^|\s)language-([^\s]+)/)?.[1];
    if (declaredLanguage && code.parentElement) {
      code.parentElement.dataset.language = declaredLanguage;
      code.parentElement.setAttribute("aria-label", `${declaredLanguage} code block`);
    }
    hljs.highlightElement(code);
  }
  for (const link of markdownPreview.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (href.startsWith("#")) continue;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  followScroll(markdownInput, markdownPreview);
}

function followScroll(source, target) {
  // A programmatic scroll dispatches its event after this handler returns.
  // Keep the user's pane as the driver until the browser paints, otherwise
  // the target can immediately feed a rounded scroll position back to it.
  if (scrollSource && scrollSource !== source) return;
  scrollSource = source;
  applyScrollRatio(target, scrollRatio(source));
  const token = ++scrollSyncToken;
  requestAnimationFrame(() => {
    if (scrollSyncToken === token) scrollSource = null;
  });
}

markdownInput.addEventListener("input", renderMarkdown);
markdownInput.addEventListener("scroll", () => followScroll(markdownInput, markdownPreview));
markdownPreview.addEventListener("scroll", () => followScroll(markdownPreview, markdownInput));
markdownInput.addEventListener("paste", () => {
  requestAnimationFrame(() => {
    markdownInput.scrollTop = 0;
    markdownPreview.scrollTop = 0;
  });
});
renderMarkdown();

requestAnimationFrame(restoreDraftScroll);

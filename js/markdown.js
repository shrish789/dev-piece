const markdownInput = document.getElementById("markdown-input");
const markdownPreview = document.getElementById("markdown-preview");
let scrollLock = false;

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
  for (const link of markdownPreview.querySelectorAll("a[href]")) {
    const href = link.getAttribute("href");
    if (href.startsWith("#")) continue;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
  }
  scrollLock = true;
  applyScrollRatio(markdownPreview, scrollRatio(markdownInput));
  scrollLock = false;
}

function followScroll(source, target) {
  if (scrollLock) return;
  scrollLock = true;
  applyScrollRatio(target, scrollRatio(source));
  scrollLock = false;
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

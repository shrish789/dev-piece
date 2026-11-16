const COPY_FEEDBACK_MS = 1200;

function writeClipboard(text) {
  if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
    return navigator.clipboard.writeText(text);
  }
  const area = document.createElement("textarea");
  area.value = text;
  area.setAttribute("readonly", "");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.append(area);
  area.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } finally {
    area.remove();
  }
  if (!copied) throw new Error("Clipboard is unavailable");
  return Promise.resolve();
}

async function copyToClipboard(button, text, status) {
  if (text === "") return;
  if (button.dataset.copyLabel === undefined) button.dataset.copyLabel = button.textContent;
  try {
    await writeClipboard(text);
  } catch (error) {
    const usesStatusClass = status.classList.contains("status");
    status.textContent = "Copy failed: " + error.message;
    status.className = usesStatusClass ? "status error" : "error";
    return;
  }
  button.textContent = "Copied";
  setTimeout(() => {
    button.textContent = button.dataset.copyLabel;
  }, COPY_FEEDBACK_MS);
}

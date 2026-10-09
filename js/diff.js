function linesOf(change) {
  if (change.value === "") return [];
  const text = change.value.endsWith("\n") ? change.value.slice(0, -1) : change.value;
  return text.split("\n");
}

function lineClass(change) {
  if (change.added) return "added";
  if (change.removed) return "removed";
  return "same";
}

function linePrefix(change) {
  if (change.added) return "+ ";
  if (change.removed) return "- ";
  return "  ";
}

const leftInput = document.getElementById("diff-left");
const rightInput = document.getElementById("diff-right");
const diffResult = document.getElementById("diff-result");
const diffStatus = document.getElementById("diff-status");

function readChosenFile(fileInput, textarea) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = String(reader.result);
    };
    reader.onerror = () => {
      diffStatus.textContent = "Could not read file";
      diffStatus.className = "status error";
    };
    reader.readAsText(file);
  });
}

readChosenFile(document.getElementById("diff-left-file"), leftInput);
readChosenFile(document.getElementById("diff-right-file"), rightInput);

document.getElementById("compare").addEventListener("click", () => {
  const changes = Diff.diffLines(leftInput.value, rightInput.value);
  const fragment = document.createDocumentFragment();
  let added = 0;
  let removed = 0;
  for (const change of changes) {
    const lines = linesOf(change);
    if (change.added) added += lines.length;
    if (change.removed) removed += lines.length;
    for (const line of lines) {
      const row = document.createElement("div");
      row.className = "diff-line " + lineClass(change);
      row.textContent = linePrefix(change) + line;
      fragment.append(row);
    }
  }
  diffResult.replaceChildren(fragment);
  diffStatus.textContent = added === 0 && removed === 0 ? "Same" : `${added} added, ${removed} removed`;
  diffStatus.className = "status";
});

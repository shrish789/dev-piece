function linesOfValue(value) {
  if (value === "") return [];
  const lines = value.split(/\r\n|\r|\n/);
  if (/\r\n$|\r$|\n$/.test(value)) lines.pop();
  return lines;
}

const leftInput = document.getElementById("diff-left");
const rightInput = document.getElementById("diff-right");
const leftFile = document.getElementById("diff-left-file");
const rightFile = document.getElementById("diff-right-file");
const diffResult = document.getElementById("diff-result");
const diffStatus = document.getElementById("diff-status");
const diffMode = document.getElementById("diff-mode");
const compareButton = document.getElementById("compare");
const swapButton = document.getElementById("diff-swap");
const clearButton = document.getElementById("diff-clear");
let hasCompared = false;

function updateCompareAvailability() {
  const isEmpty = leftInput.value === "" && rightInput.value === "";
  compareButton.disabled = isEmpty;
  swapButton.disabled = isEmpty;
  clearButton.disabled = isEmpty;
}

function readChosenFile(fileInput, textarea) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      textarea.value = String(reader.result);
      textarea.dispatchEvent(new Event("input"));
    };
    reader.onerror = () => {
      diffStatus.textContent = "Could not read file";
      diffStatus.className = "status error";
    };
    reader.readAsText(file);
  });
}

readChosenFile(leftFile, leftInput);
readChosenFile(rightFile, rightInput);

function resultHeader(detail) {
  const header = document.createElement("div");
  header.className = "diff-result-header";
  for (const [title, hint] of [["Original", detail], ["Changed", detail]]) {
    const side = document.createElement("div");
    const name = document.createElement("strong");
    name.textContent = title;
    const description = document.createElement("span");
    description.className = "diff-header-hint";
    description.textContent = hint;
    side.append(name, description);
    header.append(side);
  }
  return header;
}

function diffCell(position, text, kind = "same", inlineChanges, side) {
  const cell = document.createElement("div");
  cell.className = `diff-cell ${kind}`;
  if (position === null) cell.className += " empty";

  const gutter = document.createElement("span");
  gutter.className = "diff-gutter";
  gutter.textContent = position ?? "";
  const content = document.createElement("code");
  content.className = "diff-cell-content";

  if (inlineChanges) {
    for (const change of inlineChanges) {
      if ((side === "left" && change.added) || (side === "right" && change.removed)) continue;
      const span = document.createElement("span");
      span.textContent = change.value;
      if (change.removed) span.className = "diff-inline removed";
      if (change.added) span.className = "diff-inline added";
      content.append(span);
    }
  } else {
    content.textContent = text ?? "";
  }
  cell.append(gutter, content);
  return cell;
}

function appendResultRow(fragment, left, right) {
  const row = document.createElement("div");
  row.className = "diff-result-row";
  row.append(left, right);
  fragment.append(row);
}

function renderLineComparison(changes, fragment) {
  let leftLine = 1;
  let rightLine = 1;
  let added = 0;
  let removed = 0;

  fragment.append(resultHeader("Line"));
  for (let index = 0; index < changes.length;) {
    const change = changes[index];
    if (!change.added && !change.removed) {
      for (const line of linesOfValue(change.value)) {
        appendResultRow(fragment,
          diffCell(String(leftLine++), line),
          diffCell(String(rightLine++), line)
        );
      }
      index += 1;
      continue;
    }

    const removedLines = [];
    const addedLines = [];
    while (index < changes.length && (changes[index].added || changes[index].removed)) {
      const changedLines = linesOfValue(changes[index].value);
      if (changes[index].removed) removedLines.push(...changedLines);
      if (changes[index].added) addedLines.push(...changedLines);
      index += 1;
    }
    removed += removedLines.length;
    added += addedLines.length;

    const rowCount = Math.max(removedLines.length, addedLines.length);
    for (let rowIndex = 0; rowIndex < rowCount; rowIndex += 1) {
      const oldLine = removedLines[rowIndex];
      const newLine = addedLines[rowIndex];
      const inlineChanges = oldLine !== undefined && newLine !== undefined
        ? Diff.diffChars(oldLine, newLine)
        : undefined;
      appendResultRow(fragment,
        oldLine === undefined
          ? diffCell(null, null, "empty")
          : diffCell(String(leftLine++), oldLine, "removed", inlineChanges, "left"),
        newLine === undefined
          ? diffCell(null, null, "empty")
          : diffCell(String(rightLine++), newLine, "added", inlineChanges, "right")
      );
    }
  }

  const leftHasNewline = /\r\n$|\r$|\n$/.test(leftInput.value);
  const rightHasNewline = /\r\n$|\r$|\n$/.test(rightInput.value);
  if (leftInput.value && rightInput.value && leftHasNewline !== rightHasNewline) {
    appendResultRow(fragment,
      leftHasNewline ? diffCell(null, null, "empty") : diffCell("", "No newline at end of file", "note"),
      rightHasNewline ? diffCell(null, null, "empty") : diffCell("", "No newline at end of file", "note")
    );
  }
  return { added, removed, unit: "lines" };
}

// Columns count Unicode code points, with CRLF treated as one line ending.
function advancePosition(position, text) {
  const parts = text.split(/\r\n|\r|\n/);
  return parts.length > 1
    ? { line: position.line + parts.length - 1, column: [...parts.at(-1)].length + 1 }
    : { line: position.line, column: position.column + [...text].length };
}

function positionLabel(start, end) {
  return `${start.line}:${start.column}–${end.line}:${end.column}`;
}

function visibleCharacters(text) {
  return text.replace(/\r\n/g, "␍↵\n").replace(/(?<!␍)\n/g, "↵\n").replace(/\r/g, "␍").replace(/\t/g, "⇥").replace(/ /g, "·");
}

function renderCharacterComparison(changes, fragment) {
  let left = { line: 1, column: 1 };
  let right = { line: 1, column: 1 };
  let added = 0;
  let removed = 0;

  fragment.append(resultHeader("Line:column"));
  for (const change of changes) {
    if (!change.value) continue;
    const leftEnd = change.added ? left : advancePosition(left, change.value);
    const rightEnd = change.removed ? right : advancePosition(right, change.value);
    if (change.added) added += [...change.value].length;
    if (change.removed) removed += [...change.value].length;
    appendResultRow(fragment,
      change.added
        ? diffCell(null, null, "empty")
        : diffCell(positionLabel(left, leftEnd), visibleCharacters(change.value), change.removed ? "removed" : "same"),
      change.removed
        ? diffCell(null, null, "empty")
        : diffCell(positionLabel(right, rightEnd), visibleCharacters(change.value), change.added ? "added" : "same")
    );
    left = leftEnd;
    right = rightEnd;
  }
  return { added, removed, unit: "characters" };
}

function compareTexts() {
  if (leftInput.value === "" && rightInput.value === "") {
    hasCompared = false;
    diffResult.replaceChildren();
    diffStatus.textContent = "";
    diffStatus.className = "status";
    return;
  }

  hasCompared = true;
  const characters = diffMode.value === "characters";
  const changes = characters
    ? Diff.diffChars(leftInput.value, rightInput.value)
    : Diff.diffLines(leftInput.value, rightInput.value);
  const fragment = document.createDocumentFragment();
  const totals = characters
    ? renderCharacterComparison(changes, fragment)
    : renderLineComparison(changes, fragment);

  diffResult.replaceChildren(fragment);
  diffStatus.textContent = totals.added === 0 && totals.removed === 0
    ? "Same"
    : `${totals.added} ${totals.unit} added, ${totals.removed} removed`;
  diffStatus.className = "status";
}

compareButton.addEventListener("click", compareTexts);
diffMode.addEventListener("change", () => {
  if (hasCompared) compareTexts();
});

for (const input of [leftInput, rightInput]) {
  input.addEventListener("input", () => {
    updateCompareAvailability();
    if (hasCompared) compareTexts();
    else {
      diffResult.replaceChildren();
      diffStatus.textContent = "";
    }
  });
}

swapButton.addEventListener("click", () => {
  [leftInput.value, rightInput.value] = [rightInput.value, leftInput.value];
  leftFile.value = "";
  rightFile.value = "";
  updateCompareAvailability();
  if (hasCompared) compareTexts();
});

clearButton.addEventListener("click", () => {
  leftInput.value = "";
  rightInput.value = "";
  leftFile.value = "";
  rightFile.value = "";
  compareTexts();
  updateCompareAvailability();
  leftInput.focus();
});

let editorScrollSource = null;
let editorScrollToken = 0;
function syncEditorScroll(source, target) {
  if (editorScrollSource && editorScrollSource !== source) return;
  editorScrollSource = source;
  const sourceRange = source.scrollHeight - source.clientHeight;
  const targetRange = target.scrollHeight - target.clientHeight;
  target.scrollTop = sourceRange > 0 ? source.scrollTop / sourceRange * targetRange : 0;
  const token = ++editorScrollToken;
  requestAnimationFrame(() => {
    if (editorScrollToken === token) editorScrollSource = null;
  });
}
leftInput.addEventListener("scroll", () => syncEditorScroll(leftInput, rightInput));
rightInput.addEventListener("scroll", () => syncEditorScroll(rightInput, leftInput));
updateCompareAvailability();

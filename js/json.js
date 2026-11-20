const JSON_INDENT = 2;
const JSON_FIRST_OPEN_DEPTH = 1;
const JSON_EXPAND_STORAGE_KEY = "json-expand";
const JSON_EXPAND_FIRST_LEVEL = "level";
const JSON_EXPAND_ALL = "expanded";
const JSON_EXPAND_NONE = "collapsed";
const JSON_EXPAND_MODES = [JSON_EXPAND_FIRST_LEVEL, JSON_EXPAND_ALL, JSON_EXPAND_NONE];

function deepParse(value) {
  if (typeof value === "string") {
    const stripped = value.trim();
    if (stripped.startsWith("{") || stripped.startsWith("[")) {
      try {
        return deepParse(JSON.parse(stripped));
      } catch {
        return value;
      }
    }
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(deepParse);
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, deepParse(item)])
    );
  }
  return value;
}

function parseJson(text) {
  return deepParse(JSON.parse(text.trim()));
}

const parsedSection = document.getElementById("parsed");
const output = document.getElementById("output");
const findbar = document.getElementById("findbar");
const searchInput = document.getElementById("search");
const searchCount = document.getElementById("search-count");
const viewButtons = {
  json: document.getElementById("view-json"),
  tree: document.getElementById("view-tree")
};
let matches = [];
let matchIndex = -1;
let parsedValue;
let hasParsed = false;
let view = localStorage.getItem("view") === "json" ? "json" : "tree";
const expandSelect = document.getElementById("json-expand");
const savedExpand = localStorage.getItem(JSON_EXPAND_STORAGE_KEY);
let expandMode = JSON_EXPAND_MODES.includes(savedExpand) ? savedExpand : JSON_EXPAND_FIRST_LEVEL;
expandSelect.value = expandMode;
let openState = new Map();

function textEl(className, text) {
  const span = document.createElement("span");
  span.className = className;
  span.textContent = text;
  return span;
}

function valueSpan(value) {
  if (value === null) return textEl("val nil", "null");
  if (typeof value === "string") return textEl("val str", JSON.stringify(value));
  if (typeof value === "number") return textEl("val num", String(value));
  return textEl("val", String(value));
}

function childPath(path, key) {
  const part = String(key);
  return path === "" ? part : path + "\0" + part;
}

function defaultOpen(depth) {
  if (expandMode === JSON_EXPAND_ALL) return true;
  if (expandMode === JSON_EXPAND_NONE) return false;
  return depth < JSON_FIRST_OPEN_DEPTH;
}

function isOpen(path, depth) {
  return openState.has(path) ? openState.get(path) : defaultOpen(depth);
}

function captureOpenState() {
  const next = new Map();
  for (const details of output.querySelectorAll("details")) {
    next.set(details.dataset.path, details.open);
  }
  if (next.size) openState = next;
}

function nodeView(value, key, depth, path) {
  const isContainer = value !== null && typeof value === "object";
  if (!isContainer) {
    const row = document.createElement("div");
    row.className = "leaf";
    if (key !== null) row.append(textEl("key", String(key)), ": ");
    row.append(valueSpan(value));
    return row;
  }

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((item, index) => [index, item]) : Object.entries(value);
  const details = document.createElement("details");
  details.dataset.path = path;
  details.open = isOpen(path, depth);
  const summary = document.createElement("summary");
  if (key !== null) summary.append(textEl("key", String(key)), " ");
  summary.append(isArray ? `[${entries.length}]` : `{${entries.length}}`);
  const children = document.createElement("div");
  children.className = "children";
  for (const [childKey, childValue] of entries) {
    children.append(nodeView(childValue, childKey, depth + 1, childPath(path, childKey)));
  }
  details.append(summary, children);
  return details;
}

function appendJsonKey(parent, key) {
  parent.append(textEl("key", JSON.stringify(String(key))), ": ");
}

function jsonLeaf(value, key, last) {
  const row = document.createElement("div");
  row.className = "leaf";
  if (key !== null) appendJsonKey(row, key);
  if (value !== null && typeof value === "object") row.append(Array.isArray(value) ? "[]" : "{}");
  else row.append(valueSpan(value));
  if (!last) row.append(",");
  return row;
}

function jsonNode(value, key, depth, last, path) {
  const isContainer = value !== null && typeof value === "object";
  if (!isContainer) return jsonLeaf(value, key, last);

  const isArray = Array.isArray(value);
  const entries = isArray ? value.map((item, index) => [null, item, index]) : Object.entries(value).map(([entryKey, entryValue]) => [entryKey, entryValue, entryKey]);
  if (!entries.length) return jsonLeaf(value, key, last);

  const details = document.createElement("details");
  details.dataset.path = path;
  details.open = isOpen(path, depth);
  const summary = document.createElement("summary");
  if (key !== null) appendJsonKey(summary, key);
  summary.append(textEl("when-open", isArray ? "[" : "{"), textEl("when-closed", isArray ? "[…]" : "{…}"));
  if (!last) summary.append(textEl("when-closed", ","));

  const children = document.createElement("div");
  children.className = "children";
  entries.forEach(([childKey, childValue, pathKey], index) => {
    children.append(jsonNode(childValue, childKey, depth + 1, index === entries.length - 1, childPath(path, pathKey)));
  });
  const end = document.createElement("div");
  end.className = "end";
  end.textContent = (isArray ? "]" : "}") + (last ? "" : ",");
  children.append(end);
  details.append(summary, children);
  return details;
}

function renderCurrent(keepOpen) {
  if (keepOpen) captureOpenState();
  else openState = new Map();
  output.dataset.view = view;
  if (!hasParsed) return;
  const root = view === "json" ? jsonNode(parsedValue, null, 0, true, "") : nodeView(parsedValue, null, 0, "");
  output.replaceChildren(root);
  runSearch(keepOpen ? false : undefined);
}

function applyView(next) {
  view = next;
  localStorage.setItem("view", view);
  viewButtons.json.classList.toggle("active", view === "json");
  viewButtons.tree.classList.toggle("active", view === "tree");
  renderCurrent(true);
}

function clearMarks() {
  for (const node of output.querySelectorAll(".key, .val")) {
    if (node.querySelector("mark")) node.textContent = node.textContent;
  }
  matches = [];
  matchIndex = -1;
}

function openAncestors(node) {
  let parent = node.parentElement;
  while (parent && parent !== output) {
    if (parent.tagName === "DETAILS") parent.open = true;
    parent = parent.parentElement;
  }
}

function showMatch(reveal) {
  for (const mark of matches) mark.classList.remove("current");
  if (!matches.length) {
    searchCount.textContent = searchInput.value.trim() ? "0" : "";
    return;
  }
  const mark = matches[matchIndex];
  if (reveal !== false) {
    openAncestors(mark);
    mark.scrollIntoView({ block: "center" });
  }
  mark.classList.add("current");
  searchCount.textContent = `${matchIndex + 1}/${matches.length}`;
}

function highlight(node, query) {
  const text = node.textContent;
  const lower = text.toLowerCase();
  const needle = query.toLowerCase();
  const fragment = document.createDocumentFragment();
  let start = 0;
  let found = false;
  let index = lower.indexOf(needle);
  while (index !== -1) {
    found = true;
    if (index > start) fragment.append(text.slice(start, index));
    const mark = document.createElement("mark");
    mark.textContent = text.slice(index, index + needle.length);
    fragment.append(mark);
    start = index + needle.length;
    index = lower.indexOf(needle, start);
  }
  if (!found) return;
  if (start < text.length) fragment.append(text.slice(start));
  node.replaceChildren(fragment);
}

function runSearch(reveal) {
  clearMarks();
  const query = searchInput.value.trim();
  if (!query) {
    searchCount.textContent = "";
    return;
  }
  for (const node of output.querySelectorAll(".key, .val")) highlight(node, query);
  matches = [...output.querySelectorAll("mark")];
  matchIndex = matches.length ? 0 : -1;
  showMatch(reveal);
}

function stepMatch(direction) {
  if (!matches.length) return;
  matchIndex = (matchIndex + direction + matches.length) % matches.length;
  showMatch();
}

function showFindbar() {
  findbar.hidden = false;
  searchInput.focus();
  searchInput.select();
}

function hideFindbar() {
  findbar.hidden = true;
  searchInput.value = "";
  runSearch();
  output.focus();
}

searchInput.addEventListener("input", runSearch);
searchInput.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    hideFindbar();
    return;
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  stepMatch(event.shiftKey ? -1 : 1);
});
document.getElementById("prev").addEventListener("click", () => stepMatch(-1));
document.getElementById("next").addEventListener("click", () => stepMatch(1));
document.getElementById("copy-json").addEventListener("click", () => {
  const status = document.getElementById("status");
  if (!hasParsed) {
    status.textContent = "Nothing to copy";
    status.className = "warning";
    return;
  }
  copyToClipboard(document.getElementById("copy-json"), JSON.stringify(parsedValue, null, JSON_INDENT), status);
});
expandSelect.addEventListener("change", () => {
  if (!JSON_EXPAND_MODES.includes(expandSelect.value)) return;
  expandMode = expandSelect.value;
  try {
    localStorage.setItem(JSON_EXPAND_STORAGE_KEY, expandMode);
  } catch {
    // The choice still applies until the page is reloaded.
  }
  renderCurrent(false);
});
viewButtons.json.addEventListener("click", () => applyView("json"));
viewButtons.tree.addEventListener("click", () => applyView("tree"));
applyView(view);

let parsedActive = false;
document.addEventListener("pointerdown", (event) => {
  parsedActive = parsedSection.contains(event.target);
});
document.addEventListener("focusin", (event) => {
  parsedActive = parsedSection.contains(event.target);
});

document.addEventListener("keydown", (event) => {
  if (event.key.toLowerCase() !== "f" || event.altKey || event.shiftKey) return;
  if (!event.metaKey && !event.ctrlKey) return;
  if (!parsedActive && !parsedSection.contains(event.target)) return;
  event.preventDefault();
  showFindbar();
}, true);

document.getElementById("parse").addEventListener("click", () => {
  const status = document.getElementById("status");
  try {
    parsedValue = parseJson(document.getElementById("input").value);
    hasParsed = true;
    status.textContent = "Parsed";
    status.className = "";
    renderCurrent(false);
  } catch (error) {
    hasParsed = false;
    output.replaceChildren();
    clearMarks();
    searchCount.textContent = "";
    status.textContent = error.message;
    status.className = "error";
  }
});

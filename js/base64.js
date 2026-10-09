function encodeBase64(text) {
  const bytes = new TextEncoder().encode(text);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function decodeBase64(text) {
  const binary = atob(text.replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

if (typeof document !== "undefined") {
  const input = document.getElementById("base64-input");
  const output = document.getElementById("base64-output");
  const status = document.getElementById("base64-status");
  const inputLabel = document.getElementById("base64-input-label");
  const outputLabel = document.getElementById("base64-output-label");
  const encodeButton = document.getElementById("encode");
  const decodeButton = document.getElementById("decode");
  const modeCopy = {
    encode: {
      source: "Text",
      result: "Base64",
      sourcePlaceholder: "Paste text",
      resultPlaceholder: "Base64 appears here"
    },
    decode: {
      source: "Base64",
      result: "Text",
      sourcePlaceholder: "Paste base64",
      resultPlaceholder: "Text appears here"
    }
  };
  let mode = localStorage.getItem("base64-mode") === "decode" ? "decode" : "encode";

  function setStatus(message, isError) {
    status.textContent = message;
    status.className = isError ? "status error" : "status";
  }

  function convert() {
    if (input.value === "") {
      output.value = "";
      setStatus("", false);
      return;
    }
    try {
      output.value = mode === "encode" ? encodeBase64(input.value) : decodeBase64(input.value);
      setStatus(mode === "encode" ? "Encoded" : "Decoded", false);
    } catch (error) {
      setStatus(error.message, true);
    }
  }

  function applyMode(next, carryResult) {
    if (carryResult && next === mode) return;
    if (carryResult && output.value) input.value = output.value;
    mode = next;
    localStorage.setItem("base64-mode", mode);
    const copy = modeCopy[mode];
    encodeButton.classList.toggle("active", mode === "encode");
    decodeButton.classList.toggle("active", mode === "decode");
    inputLabel.textContent = copy.source;
    outputLabel.textContent = copy.result;
    input.placeholder = copy.sourcePlaceholder;
    output.placeholder = copy.resultPlaceholder;
    output.value = "";
    setStatus("", false);
    convert();
  }

  encodeButton.addEventListener("click", () => applyMode("encode", true));
  decodeButton.addEventListener("click", () => applyMode("decode", true));
  input.addEventListener("input", convert);
  applyMode(mode, false);
}

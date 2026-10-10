function jwtBase64UrlBytes(value, label = "segment") {
  if (!/^[A-Za-z0-9_-]*$/.test(value)) throw new Error(`${label} is not valid Base64URL`);
  if (value.length % 4 === 1) throw new Error(`${label} has invalid Base64URL length`);
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  let binary;
  try {
    binary = atob(padded);
  } catch {
    throw new Error(`${label} is not valid Base64URL`);
  }
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function jwtJsonSegment(value, label) {
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(jwtBase64UrlBytes(value, label));
  } catch (error) {
    if (error.message.includes("Base64URL")) throw error;
    throw new Error(`${label} is not valid UTF-8`);
  }
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${label} is not valid JSON`);
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`${label} must be a JSON object`);
  }
  return parsed;
}

function normalizeJwtInput(token) {
  const input = token.trim();
  if (/^Bearer(?:\s|$)/i.test(input)) {
    const compact = input.replace(/^Bearer\s*/i, "").trim();
    if (!compact) throw new Error("Paste a JWT after the Bearer prefix");
    return compact;
  }
  return input;
}

function decodeJwt(token) {
  const compact = normalizeJwtInput(token);
  if (!compact) throw new Error("Paste a JWT to decode");
  if (/\s/.test(compact)) throw new Error("A compact JWT cannot contain whitespace");
  const parts = compact.split(".");
  if (parts.length === 5) throw new Error("This is an encrypted JWE; its payload needs a decryption key");
  if (parts.length !== 3) throw new Error("A signed compact JWT must contain three dot-separated parts");
  if (!parts[0] || !parts[1]) throw new Error("JWT header and payload segments cannot be empty");
  return {
    compact,
    parts,
    header: jwtJsonSegment(parts[0], "JWT header"),
    payload: jwtJsonSegment(parts[1], "JWT payload")
  };
}

async function verifyHmacJwt(token, secret) {
  const decoded = decodeJwt(token);
  const hash = { HS256: "SHA-256", HS384: "SHA-384", HS512: "SHA-512" }[decoded.header.alg];
  if (!hash) throw new Error("HMAC verification supports HS256, HS384, and HS512 only");
  if (!secret) throw new Error("Enter the HMAC secret used to sign this token");
  if (!decoded.parts[2]) return false;
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash },
    false,
    ["verify"]
  );
  return globalThis.crypto.subtle.verify(
    "HMAC",
    key,
    jwtBase64UrlBytes(decoded.parts[2], "JWT signature"),
    encoder.encode(`${decoded.parts[0]}.${decoded.parts[1]}`)
  );
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = { decodeJwt, verifyHmacJwt };
}

if (typeof document !== "undefined") {
  const jwtInput = document.getElementById("jwt-input");
  const jwtHeader = document.getElementById("jwt-header");
  const jwtPayload = document.getElementById("jwt-payload");
  const jwtSignature = document.getElementById("jwt-signature");
  const jwtClaims = document.getElementById("jwt-claims");
  const jwtStatus = document.getElementById("jwt-status");
  const jwtSecret = document.getElementById("jwt-secret");
  const jwtVerification = document.getElementById("jwt-verification");
  const decodeJwtButton = document.getElementById("decode-jwt");
  const verifyJwtButton = document.getElementById("verify-jwt");
  const clearJwtButton = document.getElementById("jwt-clear");
  let currentJwt;

  function setJwtStatus(message, type = "") {
    jwtStatus.textContent = message;
    jwtStatus.className = `status${type ? ` ${type}` : ""}`;
  }

  function setJwtVerification(message, type = "") {
    jwtVerification.textContent = message;
    jwtVerification.className = `status jwt-verification${type ? ` ${type}` : ""}`;
  }

  function updateJwtActions() {
    const empty = jwtInput.value.trim() === "";
    decodeJwtButton.disabled = empty;
    clearJwtButton.disabled = empty;
  }

  function clearJwtOutput() {
    currentJwt = undefined;
    jwtHeader.textContent = "Paste a token to inspect its header.";
    jwtPayload.textContent = "Claims will appear here.";
    jwtSignature.textContent = "Not decoded or verified.";
    jwtClaims.replaceChildren();
    jwtSecret.disabled = true;
    verifyJwtButton.disabled = true;
    setJwtVerification("");
  }

  function dateDescription(name, value) {
    if (typeof value !== "number" || !Number.isFinite(value)) return "Expected a NumericDate value";
    const date = new Date(value * 1000);
    if (Number.isNaN(date.getTime())) return "Invalid NumericDate value";
    const now = Date.now();
    if (name === "exp") return `${now >= date.getTime() ? "Expired" : "Expires"} · ${date.toLocaleString()} · ${date.toISOString()}`;
    if (name === "nbf") return `${now < date.getTime() ? "Not active yet" : "Active"} · ${date.toLocaleString()} · ${date.toISOString()}`;
    return `Issued · ${date.toLocaleString()} · ${date.toISOString()}`;
  }

  function renderJwtClaims(payload) {
    const fragment = document.createDocumentFragment();
    for (const name of ["exp", "nbf", "iat"]) {
      if (!(name in payload)) continue;
      const row = document.createElement("div");
      row.className = "jwt-claim";
      const key = document.createElement("strong");
      key.textContent = name;
      const description = document.createElement("span");
      description.textContent = dateDescription(name, payload[name]);
      row.append(key, description);
      fragment.append(row);
    }
    jwtClaims.replaceChildren(fragment);
  }

  function renderDecodedJwt() {
    updateJwtActions();
    if (!jwtInput.value.trim()) {
      clearJwtOutput();
      setJwtStatus("");
      return;
    }
    try {
      currentJwt = decodeJwt(jwtInput.value);
      jwtHeader.textContent = JSON.stringify(currentJwt.header, null, 2);
      jwtPayload.textContent = JSON.stringify(currentJwt.payload, null, 2);
      jwtSignature.textContent = currentJwt.parts[2] || "Empty signature segment";
      renderJwtClaims(currentJwt.payload);
      const hmac = ["HS256", "HS384", "HS512"].includes(currentJwt.header.alg);
      jwtSecret.disabled = !hmac;
      verifyJwtButton.disabled = !hmac || !jwtSecret.value;
      setJwtVerification(hmac ? "Enter the signing secret to verify this HMAC signature" : "This signature has not been verified");
      setJwtStatus("Decoded only; authenticity is not verified", "warning");
    } catch (error) {
      clearJwtOutput();
      setJwtStatus(error.message, "error");
    }
  }

  jwtInput.addEventListener("input", renderDecodedJwt);
  jwtSecret.addEventListener("input", () => {
    verifyJwtButton.disabled = jwtSecret.value === "" || jwtSecret.disabled;
    setJwtVerification(jwtSecret.value ? "Secret entered; choose Verify" : "Enter the signing secret to verify this HMAC signature");
  });
  decodeJwtButton.addEventListener("click", renderDecodedJwt);
  verifyJwtButton.addEventListener("click", async () => {
    const tokenAtStart = jwtInput.value;
    verifyJwtButton.disabled = true;
    setJwtVerification("Verifying…");
    try {
      const valid = await verifyHmacJwt(tokenAtStart, jwtSecret.value);
      if (jwtInput.value !== tokenAtStart) return;
      setJwtVerification(valid ? "Signature verified" : "Signature does not match", valid ? "" : "error");
      setJwtStatus(valid ? "Decoded and HMAC signature verified" : "Decoded, but signature verification failed", valid ? "" : "error");
    } catch (error) {
      setJwtVerification(error.message, "error");
    } finally {
      verifyJwtButton.disabled = jwtSecret.value === "" || jwtSecret.disabled;
    }
  });
  clearJwtButton.addEventListener("click", () => {
    jwtInput.value = "";
    jwtSecret.value = "";
    updateJwtActions();
    clearJwtOutput();
    setJwtStatus("");
    jwtInput.focus();
  });

  updateJwtActions();
}

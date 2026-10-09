const fs = require("fs");
const vm = require("vm");

const context = {
  TextEncoder,
  TextDecoder,
  Uint8Array,
  btoa,
  atob
};
vm.runInNewContext(fs.readFileSync("js/base64.js", "utf8"), context);

const sample = "hello 海賊\nline";
if (context.decodeBase64(context.encodeBase64(sample)) !== sample) {
  throw new Error("UTF-8 round trip failed");
}

const wrapped = context.encodeBase64(sample).replace(/(.{8})/g, "$1\n");
if (context.decodeBase64(wrapped) !== sample) {
  throw new Error("whitespace in base64 should be ignored");
}

let rejected = false;
try {
  context.decodeBase64("!!!!");
} catch {
  rejected = true;
}
if (!rejected) throw new Error("invalid base64 should fail");

let badUtf8 = false;
try {
  context.decodeBase64(btoa("\xff"));
} catch {
  badUtf8 = true;
}
if (!badUtf8) throw new Error("invalid UTF-8 should fail");

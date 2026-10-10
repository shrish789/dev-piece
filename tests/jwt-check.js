const assert = require("node:assert/strict");
const { createHmac } = require("node:crypto");
const { decodeJwt, verifyHmacJwt } = require("../js/jwt.js");

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

async function main() {
  const header = encodeJson({ alg: "HS256", typ: "JWT" });
  const payload = encodeJson({ sub: "123", exp: 4102444800 });
  const signingInput = `${header}.${payload}`;
  const signature = createHmac("sha256", "correct secret").update(signingInput).digest("base64url");
  const token = `${signingInput}.${signature}`;

  const decoded = decodeJwt(token);
  assert.equal(decoded.header.alg, "HS256");
  assert.equal(decoded.payload.sub, "123");
  assert.equal(decodeJwt(`Bearer ${token}`).payload.sub, "123");
  assert.equal(decodeJwt(`bearer\t${token}`).header.alg, "HS256");
  assert.equal(await verifyHmacJwt(token, "correct secret"), true);
  assert.equal(await verifyHmacJwt(`Bearer ${token}`, "correct secret"), true);
  assert.equal(await verifyHmacJwt(token, "wrong secret"), false);
  assert.throws(() => decodeJwt("Bearer"), /after the Bearer prefix/);
  assert.throws(() => decodeJwt("one.two"), /three dot-separated parts/);
  assert.throws(() => decodeJwt("one.two.three.four.five"), /encrypted JWE/);
  assert.throws(() => decodeJwt("%%%%.e30.signature"), /Base64URL/);
  console.log("JWT checks passed: compact and Bearer decoding, malformed tokens, JWE detection, and HMAC verification.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

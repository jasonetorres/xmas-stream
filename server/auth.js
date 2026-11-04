import crypto from "node:crypto";

const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function normalizeCode(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 80);
}

export function generateCode() {
  const chars = [];
  for (let i = 0; i < 16; i++) chars.push(ALPHABET[crypto.randomInt(ALPHABET.length)]);
  return `${chars.slice(0, 4).join("")}-${chars.slice(4, 8).join("")}-${chars.slice(8, 12).join("")}-${chars.slice(12).join("")}`;
}

export function codeHash(secret, code) {
  return crypto.createHmac("sha256", secret).update(normalizeCode(code)).digest("hex");
}

function encKey(secret) {
  return crypto.createHash("sha256").update(`enc:${secret}`).digest();
}

export function encryptCode(secret, code) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encKey(secret), iv);
  const enc = Buffer.concat([cipher.update(code, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptCode(secret, payload) {
  try {
    const buf = Buffer.from(payload, "base64url");
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", encKey(secret), iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(enc), decipher.final()]).toString("utf8");
  } catch {
    return "";
  }
}

export function signSession(secret, payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function readSession(secret, token) {
  if (!token || !token.includes(".")) return null;
  const [body, sig] = token.split(".");
  const expected = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (!payload || payload.v !== 1 || !payload.exp || payload.exp * 1000 < Date.now()) return null;
  if (payload.role !== "admin" && payload.role !== "sponsor") return null;
  return payload;
}

export function sessionCookie(token, { secure }) {
  const parts = [`stream_session=${token}`, "HttpOnly", "SameSite=Lax", "Path=/", `Max-Age=${14 * 24 * 60 * 60}`];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function clearCookie({ secure }) {
  const parts = ["stream_session=", "HttpOnly", "SameSite=Lax", "Path=/", "Max-Age=0"];
  if (secure) parts.push("Secure");
  return parts.join("; ");
}

export function safeEqualHex(a, b) {
  const ba = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

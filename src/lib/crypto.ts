// ── helpers ──────────────────────────────────────────────────────────────────

export function b64encode(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function b64decode(s: string): ArrayBuffer {
  const bin = atob(s.trim().replace(/\s/g, ""));
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

// ── key generation ────────────────────────────────────────────────────────────

export async function generateKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(
    { name: "RSA-OAEP", modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: "SHA-256" },
    true,
    ["encrypt", "decrypt"]
  );
}

export async function exportPublicKey(key: CryptoKey): Promise<string> {
  const buf = await crypto.subtle.exportKey("spki", key);
  return b64encode(buf);
}

// ── private key wrapping (PBKDF2 → AES-GCM) ──────────────────────────────────
// AES-KW requires input to be a multiple of 8 bytes; PKCS8 RSA-2048 is 1218
// bytes (not a multiple of 8), so we use AES-GCM instead which has no such
// constraint. The IV is prepended to the ciphertext and stored together.

export function generateSalt(): string {
  return b64encode(crypto.getRandomValues(new Uint8Array(16)).buffer);
}

async function deriveAesGcmKey(password: string, saltB64: string): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: b64decode(saltB64), iterations: 310_000, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function wrapPrivateKey(privateKey: CryptoKey, password: string, saltB64: string): Promise<string> {
  const key = await deriveAesGcmKey(password, saltB64);
  const pkcs8 = await crypto.subtle.exportKey("pkcs8", privateKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, pkcs8);
  // store iv (12 bytes) + ciphertext together
  const out = new Uint8Array(12 + ciphertext.byteLength);
  out.set(iv, 0);
  out.set(new Uint8Array(ciphertext), 12);
  return b64encode(out.buffer);
}

export async function unwrapPrivateKey(wrappedB64: string, password: string, saltB64: string): Promise<CryptoKey> {
  const key = await deriveAesGcmKey(password, saltB64);
  const buf = new Uint8Array(b64decode(wrappedB64));
  const iv = buf.slice(0, 12);
  const ciphertext = buf.slice(12);
  const pkcs8 = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ciphertext);
  return crypto.subtle.importKey(
    "pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, false, ["decrypt"]
  );
}

// ── message encryption ────────────────────────────────────────────────────────

export interface EncryptedPayload {
  ciphertext: string;
  iv: string;
  encryptedKey: string;
  encryptedKeyForSelf: string;
}

export async function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderPublicKeyB64: string
): Promise<EncryptedPayload> {
  const aesKey = await crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv }, aesKey, new TextEncoder().encode(plaintext)
  );
  const rawAes = await crypto.subtle.exportKey("raw", aesKey);

  const recipientPubKey = await crypto.subtle.importKey(
    "spki", b64decode(recipientPublicKeyB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
  );
  const senderPubKey = await crypto.subtle.importKey(
    "spki", b64decode(senderPublicKeyB64), { name: "RSA-OAEP", hash: "SHA-256" }, false, ["encrypt"]
  );

  return {
    ciphertext: b64encode(ciphertext),
    iv: b64encode(iv.buffer),
    encryptedKey: b64encode(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, recipientPubKey, rawAes)),
    encryptedKeyForSelf: b64encode(await crypto.subtle.encrypt({ name: "RSA-OAEP" }, senderPubKey, rawAes)),
  };
}

export async function decryptMessage(
  payload: EncryptedPayload,
  privateKey: CryptoKey,
  isSender: boolean
): Promise<string> {
  const keyBlob = isSender ? payload.encryptedKeyForSelf : payload.encryptedKey;
  const rawAes = await crypto.subtle.decrypt({ name: "RSA-OAEP" }, privateKey, b64decode(keyBlob));
  const aesKey = await crypto.subtle.importKey("raw", rawAes, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(payload.iv) }, aesKey, b64decode(payload.ciphertext));
  return new TextDecoder().decode(plain);
}

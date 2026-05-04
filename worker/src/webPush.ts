/**
 * Web Push send helper for Cloudflare Workers.
 *
 * Implements RFC 8030 (delivery) + RFC 8291 (aes128gcm payload encryption)
 * + RFC 8292 (VAPID auth) using only the Web Crypto API available in
 * Workers. No Node-only dependencies.
 *
 * This module exposes a single `sendPush(sub, payload, vapid)` function.
 * The crypto helpers below are exported so the test file can exercise them.
 */

export interface PushSubscriptionData {
  endpoint: string;
  /** Base64url, 65-byte uncompressed P-256 public key (UA's). */
  p256dh: string;
  /** Base64url, 16-byte auth secret. */
  auth_secret: string;
}

export interface VapidConfig {
  /** Base64url, 32-byte ECDSA P-256 private scalar. */
  privateKey: string;
  /** Base64url, 65-byte uncompressed P-256 public key. */
  publicKey: string;
  /** mailto:… or https://… identifier. */
  subject: string;
}

// ─── Base64URL helpers ───────────────────────────────────────────────────────

export function b64urlEncode(buf: ArrayBuffer | Uint8Array): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i++) str += String.fromCharCode(bytes[i]!);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function b64urlDecode(s: string): Uint8Array {
  const padding = "=".repeat((4 - (s.length % 4)) % 4);
  const base64 = (s + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  let total = 0;
  for (const a of arrays) total += a.length;
  const out = new Uint8Array(total);
  let offset = 0;
  for (const a of arrays) {
    out.set(a, offset);
    offset += a.length;
  }
  return out;
}

// ─── HMAC + HKDF ─────────────────────────────────────────────────────────────

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const ck = await crypto.subtle.importKey(
    "raw",
    key as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", ck, data as BufferSource);
  return new Uint8Array(sig);
}

/** HKDF-Expand restricted to 1 block (length ≤ 32 for SHA-256). Sufficient
 *  for all keys we derive (CEK=16, NONCE=12, IKM=32). */
async function hkdfExpand(
  prk: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const block = await hmacSha256(prk, concatBytes(info, new Uint8Array([0x01])));
  return block.slice(0, length);
}

// ─── VAPID JWT (ES256) ───────────────────────────────────────────────────────

export async function signVapidJwt(
  claims: { aud: string; exp: number; sub: string },
  privateKeyB64: string,
  publicKeyB64: string,
): Promise<string> {
  const headerB64 = b64urlEncode(
    new TextEncoder().encode(JSON.stringify({ alg: "ES256", typ: "JWT" })),
  );
  const payloadB64 = b64urlEncode(
    new TextEncoder().encode(JSON.stringify(claims)),
  );
  const signingInput = new TextEncoder().encode(`${headerB64}.${payloadB64}`);

  // Reconstruct the private JWK from d + x,y of the public key.
  const pubBytes = b64urlDecode(publicKeyB64);
  if (pubBytes.length !== 65 || pubBytes[0] !== 0x04) {
    throw new Error("VAPID public key must be 65-byte uncompressed P-256");
  }
  const x = b64urlEncode(pubBytes.slice(1, 33));
  const y = b64urlEncode(pubBytes.slice(33, 65));
  const privKey = await crypto.subtle.importKey(
    "jwk",
    {
      kty: "EC",
      crv: "P-256",
      d: privateKeyB64,
      x,
      y,
      ext: true,
      key_ops: ["sign"],
    },
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );

  // crypto.subtle returns ECDSA in IEEE P1363 form (r||s, 64 bytes for P-256),
  // which is exactly what JWT ES256 expects.
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privKey,
    signingInput as BufferSource,
  );
  const sigB64 = b64urlEncode(sig);
  return `${headerB64}.${payloadB64}.${sigB64}`;
}

// ─── aes128gcm payload encryption (RFC 8291) ─────────────────────────────────

export async function encryptPayload(
  payload: string,
  uaPubB64: string,
  authSecretB64: string,
): Promise<Uint8Array> {
  const uaPub = b64urlDecode(uaPubB64);
  const authSecret = b64urlDecode(authSecretB64);
  const data = new TextEncoder().encode(payload);

  // 1. Ephemeral server keypair.
  const serverKP = await crypto.subtle.generateKey(
    { name: "ECDH", namedCurve: "P-256" },
    true,
    ["deriveBits"],
  );
  const serverPub = new Uint8Array(
    await crypto.subtle.exportKey("raw", serverKP.publicKey),
  );

  // 2. ECDH(server_priv, ua_pub) → 32-byte shared secret.
  const uaPubKey = await crypto.subtle.importKey(
    "raw",
    uaPub as BufferSource,
    { name: "ECDH", namedCurve: "P-256" },
    false,
    [],
  );
  const shared = new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: "ECDH", public: uaPubKey },
      serverKP.privateKey,
      256,
    ),
  );

  // 3. PRK_key = HKDF-Extract(salt=auth_secret, ikm=shared)
  //    IKM     = HKDF-Expand(PRK_key, "WebPush: info\0" || ua_pub || server_pub, 32)
  const prkKey = await hmacSha256(authSecret, shared);
  const keyInfo = concatBytes(
    new TextEncoder().encode("WebPush: info\0"),
    uaPub,
    serverPub,
  );
  const ikm = await hkdfExpand(prkKey, keyInfo, 32);

  // 4. Standard aes128gcm encoding key derivation.
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const prk = await hmacSha256(salt, ikm);
  const cek = await hkdfExpand(
    prk,
    new TextEncoder().encode("Content-Encoding: aes128gcm\0"),
    16,
  );
  const nonce = await hkdfExpand(
    prk,
    new TextEncoder().encode("Content-Encoding: nonce\0"),
    12,
  );

  // 5. Pad with 0x02 delimiter (single, last record).
  const padded = new Uint8Array(data.length + 1);
  padded.set(data);
  padded[data.length] = 0x02;

  // 6. AES-128-GCM encrypt.
  const cekKey = await crypto.subtle.importKey(
    "raw",
    cek as BufferSource,
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: nonce as BufferSource },
      cekKey,
      padded as BufferSource,
    ),
  );

  // 7. Frame the body: salt(16) || rs(4 BE) || idlen(1) || keyid(65) || ciphertext.
  const rs = ciphertext.length;
  const rsBytes = new Uint8Array([
    (rs >>> 24) & 0xff,
    (rs >>> 16) & 0xff,
    (rs >>> 8) & 0xff,
    rs & 0xff,
  ]);
  return concatBytes(salt, rsBytes, new Uint8Array([65]), serverPub, ciphertext);
}

// ─── sendPush ────────────────────────────────────────────────────────────────

export interface PushResult {
  ok: boolean;
  status: number;
  /** Push service response body (often empty on success). */
  body: string;
  /** True when the subscription is permanently gone (404/410 from push service);
   *  caller should delete the row. */
  expired: boolean;
}

export async function sendPush(
  sub: PushSubscriptionData,
  payload: string,
  vapid: VapidConfig,
  ttl = 60,
): Promise<PushResult> {
  const aud = new URL(sub.endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const jwt = await signVapidJwt({ aud, exp, sub: vapid.subject }, vapid.privateKey, vapid.publicKey);
  const ciphertext = await encryptPayload(payload, sub.p256dh, sub.auth_secret);

  const res = await fetch(sub.endpoint, {
    method: "POST",
    headers: {
      "Content-Encoding": "aes128gcm",
      "Content-Type": "application/octet-stream",
      Authorization: `vapid t=${jwt}, k=${vapid.publicKey}`,
      TTL: String(ttl),
    },
    body: ciphertext as BodyInit,
  });

  return {
    ok: res.ok,
    status: res.status,
    body: await res.text().catch(() => ""),
    expired: res.status === 404 || res.status === 410,
  };
}

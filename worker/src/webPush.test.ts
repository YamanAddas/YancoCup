import { describe, it, expect } from "vitest";
import { b64urlEncode, b64urlDecode, signVapidJwt, encryptPayload } from "./webPush";

describe("b64url helpers", () => {
  it("round-trips arbitrary bytes", () => {
    const data = new Uint8Array([0, 1, 2, 250, 251, 254, 255]);
    const encoded = b64urlEncode(data);
    expect(encoded).not.toMatch(/[+/=]/);
    expect(Array.from(b64urlDecode(encoded))).toEqual(Array.from(data));
  });

  it("decodes base64url with no padding", () => {
    expect(Array.from(b64urlDecode("aGVsbG8"))).toEqual([
      104, 101, 108, 108, 111,
    ]);
  });

  it("encodes ArrayBuffer the same as Uint8Array", () => {
    const u8 = new Uint8Array([1, 2, 3]);
    expect(b64urlEncode(u8)).toBe(b64urlEncode(u8.buffer));
  });
});

// Use a fixed test VAPID keypair for deterministic JWT verification.
// Generated once with crypto.subtle ECDSA P-256.
const TEST_VAPID = {
  publicKey: "BKgbZQF_VOy66CFeBVSfMdSP0Zt7xkdCn2TdJ-fivKZjnuIgmqu_wfzqzA23cVLltMQPYpKqBXCR0wwhK6huw3s",
  privateKey: "YjXnV6pdZAoNnZ3Um5mhIg04af4K68wVsSIqSBcKask",
};

describe("signVapidJwt", () => {
  it("produces three base64url-encoded segments", async () => {
    const jwt = await signVapidJwt(
      { aud: "https://fcm.googleapis.com", exp: 1234567890, sub: "mailto:test@example.com" },
      TEST_VAPID.privateKey,
      TEST_VAPID.publicKey,
    );
    const parts = jwt.split(".");
    expect(parts).toHaveLength(3);
    for (const p of parts) expect(p).not.toMatch(/[+/=]/);
  });

  it("encodes the standard ES256 header", async () => {
    const jwt = await signVapidJwt(
      { aud: "https://example.com", exp: 1, sub: "mailto:x@y.z" },
      TEST_VAPID.privateKey,
      TEST_VAPID.publicKey,
    );
    const headerJson = new TextDecoder().decode(b64urlDecode(jwt.split(".")[0]!));
    expect(JSON.parse(headerJson)).toEqual({ alg: "ES256", typ: "JWT" });
  });

  it("preserves the claims payload", async () => {
    const claims = { aud: "https://push.example", exp: 99, sub: "mailto:hi@hi.com" };
    const jwt = await signVapidJwt(claims, TEST_VAPID.privateKey, TEST_VAPID.publicKey);
    const payloadJson = new TextDecoder().decode(b64urlDecode(jwt.split(".")[1]!));
    expect(JSON.parse(payloadJson)).toEqual(claims);
  });

  it("produces a 64-byte ECDSA signature (P1363 / ES256 layout)", async () => {
    const jwt = await signVapidJwt(
      { aud: "https://x", exp: 1, sub: "mailto:x@y" },
      TEST_VAPID.privateKey,
      TEST_VAPID.publicKey,
    );
    const sig = b64urlDecode(jwt.split(".")[2]!);
    expect(sig.length).toBe(64);
  });

  it("rejects malformed public keys", async () => {
    await expect(
      signVapidJwt(
        { aud: "https://x", exp: 1, sub: "mailto:x@y" },
        TEST_VAPID.privateKey,
        b64urlEncode(new Uint8Array([1, 2, 3])),
      ),
    ).rejects.toThrow(/65-byte/);
  });
});

describe("encryptPayload", () => {
  // We can't decrypt without the user's private key (which lives only in the
  // browser), so we sanity-check the structural framing of the encrypted body.
  // A throwaway P-256 keypair stands in for the UA's subscription keys.
  async function fakeUaSub(): Promise<{ p256dh: string; auth: string }> {
    const kp = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: "P-256" },
      true,
      ["deriveBits"],
    );
    const pub = await crypto.subtle.exportKey("raw", kp.publicKey);
    const auth = crypto.getRandomValues(new Uint8Array(16));
    return { p256dh: b64urlEncode(pub), auth: b64urlEncode(auth) };
  }

  it("frames the body per RFC 8291 (16 salt + 4 rs + 1 idlen + 65 keyid + ciphertext)", async () => {
    const sub = await fakeUaSub();
    const body = await encryptPayload("hello", sub.p256dh, sub.auth);
    expect(body.length).toBeGreaterThan(16 + 4 + 1 + 65);
    // idlen byte must equal 65 for P-256 raw key
    expect(body[16 + 4]).toBe(65);
    // First byte of keyid is 0x04 (uncompressed marker)
    expect(body[16 + 4 + 1]).toBe(0x04);
  });

  it("encodes record size big-endian and matches ciphertext length", async () => {
    const sub = await fakeUaSub();
    const body = await encryptPayload("hello world", sub.p256dh, sub.auth);
    const rs =
      (body[16]! << 24) |
      (body[17]! << 16) |
      (body[18]! << 8) |
      body[19]!;
    const ciphertextStart = 16 + 4 + 1 + 65;
    expect(rs).toBe(body.length - ciphertextStart);
  });

  it("produces different ciphertexts for the same plaintext (fresh salt + ephemeral key)", async () => {
    const sub = await fakeUaSub();
    const a = await encryptPayload("same", sub.p256dh, sub.auth);
    const b = await encryptPayload("same", sub.p256dh, sub.auth);
    expect(Array.from(a.slice(16))).not.toEqual(Array.from(b.slice(16)));
  });
});

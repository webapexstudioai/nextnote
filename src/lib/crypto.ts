import crypto from "crypto";

function getKeySecret(): string {
  const secret = process.env.API_KEY_ENCRYPTION_SECRET || process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      "API_KEY_ENCRYPTION_SECRET (or SESSION_SECRET) must be set and at least 32 characters."
    );
  }
  return secret;
}

// Format: v2:<salt-hex>:<iv-hex>:<tag-hex>:<cipher-hex>  (AES-256-GCM, per-record random salt)
// Legacy:  <iv-hex>:<cipher-hex>                         (AES-256-CBC, hardcoded salt) — still decrypts for migration
const V2 = "v2";

export function encrypt(plaintext: string): string {
  const secret = getKeySecret();
  const salt = crypto.randomBytes(16);
  const key = crypto.scryptSync(secret, salt, 32);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [V2, salt.toString("hex"), iv.toString("hex"), tag.toString("hex"), enc.toString("hex")].join(":");
}

export function decrypt(payload: string): string {
  const secret = getKeySecret();
  const parts = payload.split(":");

  if (parts[0] === V2 && parts.length === 5) {
    const [, saltHex, ivHex, tagHex, encHex] = parts;
    const key = crypto.scryptSync(secret, Buffer.from(saltHex, "hex"), 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
    decipher.setAuthTag(Buffer.from(tagHex, "hex"));
    const dec = Buffer.concat([decipher.update(Buffer.from(encHex, "hex")), decipher.final()]);
    return dec.toString("utf8");
  }

  // Legacy CBC fallback so keys stored before this upgrade still decrypt.
  if (parts.length === 2) {
    const [ivHex, encHex] = parts;
    const key = crypto.scryptSync(secret, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-cbc", key, Buffer.from(ivHex, "hex"));
    let out = decipher.update(encHex, "hex", "utf8");
    out += decipher.final("utf8");
    return out;
  }

  throw new Error("Unrecognized ciphertext format");
}

export function maskKey(key: string): string {
  if (key.length <= 8) return "****";
  return key.slice(0, 7) + "..." + key.slice(-4);
}

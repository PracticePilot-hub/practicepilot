import crypto from "crypto";

const SECRET =
  process.env.PRACTICEPILOT_EMAIL_CREDENTIAL_KEY ||
  process.env.PRACTICEPILOT_CREDENTIAL_KEY;

if (!SECRET) {
  throw new Error(
    "Missing PRACTICEPILOT_EMAIL_CREDENTIAL_KEY environment variable."
  );
}

const KEY = crypto.createHash("sha256").update(SECRET).digest();

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", KEY, iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "v1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(":");
}

export function decryptSecret(value: string) {
  const parts = String(value || "").split(":");

  if (parts.length !== 4 || parts[0] !== "v1") {
    throw new Error("Stored email credential is not in a supported format.");
  }

  const iv = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");
  const encrypted = Buffer.from(parts[3], "base64");

  const decipher = crypto.createDecipheriv("aes-256-gcm", KEY, iv);
  decipher.setAuthTag(authTag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}

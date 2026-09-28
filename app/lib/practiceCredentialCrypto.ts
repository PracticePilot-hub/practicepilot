import crypto from "crypto";

const credentialKey =
  process.env.PRACTICEPILOT_DOCUMENT_CREDENTIAL_KEY ||
  process.env.PRACTICEPILOT_EMAIL_CREDENTIAL_KEY ||
  "";

function getKey() {
  if (!credentialKey) {
    throw new Error(
      "Missing PRACTICEPILOT_DOCUMENT_CREDENTIAL_KEY or PRACTICEPILOT_EMAIL_CREDENTIAL_KEY."
    );
  }

  return crypto.createHash("sha256").update(credentialKey).digest();
}

export function encryptPracticeCredential(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", getKey(), iv);

  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);

  const authTag = cipher.getAuthTag();

  return [
    "ppcred1",
    iv.toString("base64"),
    authTag.toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}

export function decryptPracticeCredential(value: string) {
  const parts = String(value || "").split(".");

  if (parts.length !== 4 || parts[0] !== "ppcred1") {
    throw new Error("Stored PracticePilot credential has an invalid format.");
  }

  const iv = Buffer.from(parts[1], "base64");
  const authTag = Buffer.from(parts[2], "base64");
  const encrypted = Buffer.from(parts[3], "base64");

  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    getKey(),
    iv
  );

  decipher.setAuthTag(authTag);

  return Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]).toString("utf8");
}

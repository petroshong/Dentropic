import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const PREFIX = "enc:v1";

function toHex(input: Buffer): string {
  return input.toString("hex");
}

function fromHex(input: string): Buffer {
  return Buffer.from(input, "hex");
}

export interface TextCipher {
  enabled: boolean;
  encrypt(plaintext: string): string;
  decrypt(ciphertext: string): string;
}

function normalizeKey(input: string): Buffer {
  return createHash("sha256").update(input, "utf8").digest();
}

export function createTextCipher(keyMaterial?: string): TextCipher {
  if (!keyMaterial) {
    return {
      enabled: false,
      encrypt: (plaintext: string) => plaintext,
      decrypt: (ciphertext: string) => ciphertext,
    };
  }

  const key = normalizeKey(keyMaterial);

  return {
    enabled: true,
    encrypt(plaintext: string): string {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const encrypted = Buffer.concat([
        cipher.update(Buffer.from(plaintext, "utf8")),
        cipher.final(),
      ]);
      const tag = cipher.getAuthTag();
      return `${PREFIX}:${toHex(iv)}:${toHex(tag)}:${toHex(encrypted)}`;
    },
    decrypt(ciphertext: string): string {
      if (!ciphertext.startsWith(`${PREFIX}:`)) {
        return ciphertext;
      }

      const parts = ciphertext.split(":");
      if (parts.length !== 5) {
        throw new Error("Invalid ciphertext envelope");
      }

      const iv = fromHex(parts[2]);
      const tag = fromHex(parts[3]);
      const body = fromHex(parts[4]);
      const decipher = createDecipheriv("aes-256-gcm", key, iv);
      decipher.setAuthTag(tag);

      const plaintext = Buffer.concat([
        decipher.update(body),
        decipher.final(),
      ]);
      return plaintext.toString("utf8");
    },
  };
}

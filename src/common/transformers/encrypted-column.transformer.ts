import * as crypto from 'crypto';
import { ValueTransformer } from 'typeorm';

/**
 * TypeORM ValueTransformer that transparently encrypts a column's value
 * with AES-256-GCM before writing to Postgres, and decrypts it on read.
 *
 * Used on PII columns (phone, address, government ID numbers) per the
 * encryption strategy in the architecture doc: the database itself never
 * stores plaintext, so a DB-level breach does not expose these fields.
 *
 * FIELD_ENCRYPTION_KEY must be a 32-byte value, provided as a 64-char hex
 * string in the environment.
 */
const ALGORITHM = 'aes-256-gcm';

function getKey(): Buffer {
  const hex = process.env.FIELD_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'FIELD_ENCRYPTION_KEY must be set to a 64-character hex string (32 bytes) in the environment',
    );
  }
  return Buffer.from(hex, 'hex');
}

export const EncryptedColumn: ValueTransformer = {
  to(plain?: string | null): string | null {
    if (plain === null || plain === undefined) return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    // store iv + authTag + ciphertext together, base64 encoded
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
  },

  from(stored?: string | null): string | null {
    if (stored === null || stored === undefined) return null;
    const raw = Buffer.from(stored, 'base64');
    const iv = raw.subarray(0, 12);
    const authTag = raw.subarray(12, 28);
    const encrypted = raw.subarray(28);
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  },
};

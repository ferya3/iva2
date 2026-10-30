import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * AES-256-GCM for outbox payloads. Each record gets a fresh 96-bit IV, and
 * the (session, sequence) pair is bound as associated data, so a record
 * cannot be swapped or replayed into another row without detection.
 * Layout: iv(12) | tag(16) | ciphertext.
 */
export class PayloadCipher {
  constructor(private readonly key: Buffer) {
    if (key.length !== 32) throw new RangeError('PayloadCipher needs a 256-bit key');
  }

  encrypt(plaintext: string, aad: string): Buffer {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    cipher.setAAD(Buffer.from(aad));
    const body = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), body]);
  }

  decrypt(blob: Uint8Array, aad: string): string {
    const buf = Buffer.from(blob);
    const decipher = createDecipheriv('aes-256-gcm', this.key, buf.subarray(0, 12));
    decipher.setAAD(Buffer.from(aad));
    decipher.setAuthTag(buf.subarray(12, 28));
    return Buffer.concat([decipher.update(buf.subarray(28)), decipher.final()]).toString('utf8');
  }
}

import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/** Minimal subset of Electron's safeStorage (injectable for tests). */
export interface KeyProtector {
  isEncryptionAvailable(): boolean;
  encryptString(plain: string): Buffer;
  decryptString(blob: Buffer): string;
}

/**
 * Secrets at rest, protected by the OS keystore (DPAPI on Windows,
 * Keychain on macOS, libsecret on Linux) via Electron safeStorage:
 *  - the player access token of the active session;
 *  - the 256-bit outbox encryption key.
 * Files are written atomically (write + rename).
 */
export class SecureStore {
  constructor(
    private readonly dir: string,
    private readonly protector: KeyProtector,
  ) {
    mkdirSync(dir, { recursive: true });
    if (!protector.isEncryptionAvailable()) {
      throw new Error('OS-level encryption (safeStorage) is unavailable; refusing to store credentials in plain text.');
    }
  }

  private file(name: string): string {
    return join(this.dir, `${name}.bin`);
  }

  private write(name: string, value: string): void {
    const path = this.file(name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(`${path}.tmp`, this.protector.encryptString(value), { mode: 0o600 });
    renameSync(`${path}.tmp`, path);
  }

  private read(name: string): string | null {
    const path = this.file(name);
    return existsSync(path) ? this.protector.decryptString(readFileSync(path)) : null;
  }

  getToken(): string | null {
    return this.read('session-token');
  }

  setToken(token: string | null): void {
    if (token === null) rmSync(this.file('session-token'), { force: true });
    else this.write('session-token', token);
  }

  /** Returns the outbox key, generating it on first use. */
  outboxKey(): Buffer {
    const existing = this.read('outbox-key');
    if (existing) return Buffer.from(existing, 'base64');
    const key = randomBytes(32);
    this.write('outbox-key', key.toString('base64'));
    return key;
  }
}

import { createHash } from 'node:crypto';

/**
 * Certificate pinning for servers that run on a bare IP with a self-signed
 * certificate. Instead of disabling verification, the player accepts exactly
 * one certificate — the one whose SHA-256 fingerprint was baked into the
 * build (MAIN_VITE_API_CERT_SHA256, printed by scripts/install.sh).
 * Every other host keeps Chromium's normal verification.
 */

/** "sha256/<base64>" of the DER encoding of a PEM certificate. */
export function pemFingerprint(pem: string): string {
  const der = Buffer.from(
    pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, ''),
    'base64',
  );
  return `sha256/${createHash('sha256').update(der).digest('base64')}`;
}

export function parsePins(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((p) => p.trim())
    .filter(Boolean)
    .map((p) => (p.startsWith('sha256/') ? p : `sha256/${p}`));
}

interface VerifyRequest {
  hostname: string;
  certificate: { data: string };
}

/** Chromium verification results: 0 = trust, -2 = reject, -3 = default verification. */
export function createVerifyProc(apiHost: string, pins: readonly string[]) {
  return (request: VerifyRequest, callback: (result: number) => void): void => {
    if (pins.length === 0 || request.hostname !== apiHost) {
      callback(-3);
      return;
    }
    callback(pins.includes(pemFingerprint(request.certificate.data)) ? 0 : -2);
  };
}

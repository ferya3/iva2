import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createVerifyProc, parsePins, pemFingerprint } from '../electron/certificate-pin';

/** Same command scripts/install.sh uses to print the pin. */
function makeCert() {
  const dir = mkdtempSync(join(tmpdir(), 'pin-'));
  execFileSync(
    'openssl',
    [
      'req',
      '-x509',
      '-nodes',
      '-newkey',
      'rsa:2048',
      '-days',
      '1',
      '-subj',
      '/CN=203.0.113.7',
      '-addext',
      'subjectAltName=IP:203.0.113.7',
      '-keyout',
      join(dir, 'k.pem'),
      '-out',
      join(dir, 'c.pem'),
    ],
    { stdio: 'ignore' },
  );
  const pin = execFileSync('sh', [
    '-c',
    `openssl x509 -in ${join(dir, 'c.pem')} -outform der | openssl dgst -sha256 -binary | base64`,
  ])
    .toString()
    .trim();
  return { pem: readFileSync(join(dir, 'c.pem'), 'utf8'), pin: `sha256/${pin}` };
}

describe('certificate pinning', () => {
  const cert = makeCert();
  const other = makeCert();

  it('computes the same fingerprint as the installer', () => {
    expect(pemFingerprint(cert.pem)).toBe(cert.pin);
  });

  it('accepts only the pinned certificate for the API host', () => {
    const verify = createVerifyProc('203.0.113.7', parsePins(cert.pin));
    const result = (hostname: string, pem: string) => {
      let r = NaN;
      verify({ hostname, certificate: { data: pem } }, (v) => (r = v));
      return r;
    };
    expect(result('203.0.113.7', cert.pem)).toBe(0);
    expect(result('203.0.113.7', other.pem)).toBe(-2);
    expect(result('example.com', other.pem)).toBe(-3); // normal verification elsewhere
  });

  it('defers to normal verification when no pin is configured', () => {
    let r = NaN;
    createVerifyProc('203.0.113.7', parsePins(undefined))(
      { hostname: '203.0.113.7', certificate: { data: cert.pem } },
      (v) => (r = v),
    );
    expect(r).toBe(-3);
  });

  it('accepts pins with or without the sha256/ prefix', () => {
    expect(parsePins(' abc= , sha256/def= ')).toEqual(['sha256/abc=', 'sha256/def=']);
  });
});

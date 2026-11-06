import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEYLEN = 64;

function derive(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    // maxmem must exceed 128 * N * r bytes or Node throws.
    scrypt(password, salt, KEYLEN, { N, r, p, maxmem: 256 * N * r }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/**
 * scrypt via Node's built-in crypto (no native dependency to build in CI).
 * Stored as `scrypt$<log2 N>$<r>$<p>$<salt b64>$<hash b64>` so the cost can be raised later and old hashes still verify.
 */
@Injectable()
export class PasswordService {
  // OWASP minimum is N=2^17; 2^16 keeps login around 150 ms on a small host. Tests lower it via env.
  private readonly logN = Number(process.env.PASSWORD_SCRYPT_LOG_N ?? 16);

  constructor() {
    if (process.env.NODE_ENV === 'production' && this.logN < 15) {
      throw new Error('PASSWORD_SCRYPT_LOG_N must be >= 15 in production');
    }
  }

  async hash(password: string): Promise<string> {
    const salt = randomBytes(16);
    const key = await derive(password, salt, 2 ** this.logN, 8, 1);
    return ['scrypt', this.logN, 8, 1, salt.toString('base64'), key.toString('base64')].join('$');
  }

  async verify(password: string, stored: string): Promise<boolean> {
    const [scheme, logN, r, p, salt, hash] = stored.split('$');
    if (scheme !== 'scrypt' || !salt || !hash) return false;
    const expected = Buffer.from(hash, 'base64');
    const actual = await derive(password, Buffer.from(salt, 'base64'), 2 ** Number(logN), Number(r), Number(p));
    return expected.length === actual.length && timingSafeEqual(expected, actual);
  }
}

import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

// scrypt parameters (OWASP-recommended minimum: N=2^17,r=8,p=1 or equivalents;
// N=2^15 with r=8,p=3 is one of the listed equivalents).
const N = 2 ** 15;
const R = 8;
const P = 3;
const KEY_LENGTH = 32;
/** Upper bound on the cost we will accept from a stored hash, so a tampered row cannot exhaust memory. */
const MAX_N = 2 ** 20;

function derive(
  password: string,
  salt: Buffer,
  n: number,
  r: number,
  p: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize('NFKC'),
      salt,
      KEY_LENGTH,
      { N: n, r, p, maxmem: 128 * n * r * 2 },
      (err, key) => (err ? reject(err) : resolve(key)),
    );
  });
}

/** Returns `scrypt$N$r$p$salt$hash`, so parameters can be raised later without breaking old hashes. */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N, R, P);
  return [
    'scrypt',
    N,
    R,
    P,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$');
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [scheme, n, r, p, salt, hash] = stored.split('$');
  if (scheme !== 'scrypt' || !n || !r || !p || !salt || !hash) return false;
  const params = [Number(n), Number(r), Number(p)] as const;
  if (params.some((v) => !Number.isSafeInteger(v) || v <= 0)) return false;
  if (params[0] > MAX_N || params[1] > 32 || params[2] > 16) return false;
  const expected = Buffer.from(hash, 'base64url');
  const actual = await derive(
    password,
    Buffer.from(salt, 'base64url'),
    ...params,
  );
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

import { hashPassword, verifyPassword } from './password.js';

describe('password hashing', () => {
  it('verifies the correct password and rejects a wrong one', async () => {
    const hash = await hashPassword('correct horse battery');
    expect(await verifyPassword('correct horse battery', hash)).toBe(true);
    expect(await verifyPassword('correct horse batterx', hash)).toBe(false);
  });

  it('salts: the same password hashes differently each time', async () => {
    const [a, b] = await Promise.all([
      hashPassword('same-password'),
      hashPassword('same-password'),
    ]);
    expect(a).not.toBe(b);
  });

  it('stores parameters and never the password itself', async () => {
    const hash = await hashPassword('visible-secret-123');
    expect(hash).toMatch(/^scrypt\$32768\$8\$3\$[\w-]+\$[\w-]+$/);
    expect(hash).not.toContain('visible-secret-123');
  });

  it.each([
    '',
    'plaintext',
    'bcrypt$1$2$3$a$b',
    'scrypt$0$8$3$c2FsdA$aGFzaA',
    'scrypt$x$8$3$c2FsdA$aGFzaA',
  ])('rejects malformed stored value %j without throwing', async (stored) => {
    expect(await verifyPassword('anything', stored)).toBe(false);
  });

  it('refuses stored hashes that demand excessive work', async () => {
    expect(
      await verifyPassword('x', `scrypt$${2 ** 24}$8$3$c2FsdA$aGFzaA`),
    ).toBe(false);
  });
});

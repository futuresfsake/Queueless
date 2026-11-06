import { PasswordService } from './password.service';

describe('PasswordService', () => {
  beforeAll(() => {
    process.env.PASSWORD_SCRYPT_LOG_N = '10';
  });

  it('US-4: verifies the right password and rejects a wrong one', async () => {
    const s = new PasswordService();
    const stored = await s.hash('correct-horse-battery');
    expect(await s.verify('correct-horse-battery', stored)).toBe(true);
    expect(await s.verify('correct-horse-batterY', stored)).toBe(false);
  });

  it('never stores the plain password, and salts so equal passwords hash differently', async () => {
    const s = new PasswordService();
    const [a, b] = await Promise.all([s.hash('same-password-123'), s.hash('same-password-123')]);
    expect(a).not.toContain('same-password-123');
    expect(a).not.toBe(b);
  });

  it('rejects malformed stored hashes instead of throwing', async () => {
    const s = new PasswordService();
    expect(await s.verify('x', 'plaintext')).toBe(false);
    expect(await s.verify('x', '')).toBe(false);
  });

  it('keeps verifying hashes made with a different cost (the cost is stored in the hash)', async () => {
    process.env.PASSWORD_SCRYPT_LOG_N = '10';
    const stored = await new PasswordService().hash('upgrade-me-please');
    process.env.PASSWORD_SCRYPT_LOG_N = '11';
    expect(await new PasswordService().verify('upgrade-me-please', stored)).toBe(true);
    process.env.PASSWORD_SCRYPT_LOG_N = '10';
  });
});

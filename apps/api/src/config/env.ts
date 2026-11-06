/** Fail fast on unsafe configuration instead of running with a guessable secret. */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET is not set');
  if (process.env.NODE_ENV === 'production' && (secret.length < 32 || secret.startsWith('change-me'))) {
    throw new Error('JWT_SECRET must be a random value of at least 32 characters in production');
  }
  return secret;
}

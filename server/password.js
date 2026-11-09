import { randomBytes, scrypt as derive, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(derive);
export async function hash(password) {
  const salt = randomBytes(16).toString('hex');
  const key = await scrypt(password, salt, 64);
  return `scrypt:${salt}:${key.toString('hex')}`;
}
export async function compare(password, stored) {
  const [, salt, encoded] = (stored || '').split(':');
  const key = await scrypt(password, salt || 'missing-account-salt', 64);
  const expected = Buffer.from(encoded || '', 'hex');
  return expected.length === key.length && timingSafeEqual(key, expected);
}

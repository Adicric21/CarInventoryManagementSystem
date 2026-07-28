export const BCRYPT_PASSWORD_LIMIT_BYTES = 72;

export function fitsBcryptPasswordLimit(password: string): boolean {
  return Buffer.byteLength(password, 'utf8') <= BCRYPT_PASSWORD_LIMIT_BYTES;
}

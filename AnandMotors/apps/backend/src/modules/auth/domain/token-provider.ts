import type { TokenPayload } from './auth-types.js';

export interface TokenProvider {
  generate(payload: TokenPayload): Promise<string>;
  verify(token: string): Promise<TokenPayload>;
}

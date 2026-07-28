import jwt from 'jsonwebtoken';
import { z } from 'zod';

import { USER_ROLES, type TokenPayload } from '../domain/auth-types.js';
import type { TokenProvider } from '../domain/token-provider.js';

const verifiedTokenSchema = z.object({
  sub: z.string().min(1),
  email: z.string().email(),
  role: z.enum(USER_ROLES),
});

export class JwtTokenProvider implements TokenProvider {
  constructor(
    private readonly secret: string,
    private readonly expiresInSeconds: number,
  ) {}

  generate(payload: TokenPayload): Promise<string> {
    return Promise.resolve().then(() => {
      const claims = verifiedTokenSchema.parse(payload);

      return jwt.sign({ email: claims.email, role: claims.role }, this.secret, {
        algorithm: 'HS256',
        subject: claims.sub,
        expiresIn: this.expiresInSeconds,
      });
    });
  }

  verify(token: string): Promise<TokenPayload> {
    return Promise.resolve().then(() => {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] });

      return verifiedTokenSchema.parse(decoded);
    });
  }
}

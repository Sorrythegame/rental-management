import { ExtractJwt, Strategy } from 'passport-jwt';
import { PassportStrategy } from '@nestjs/passport';
import { Injectable } from '@nestjs/common';
import type { Request } from 'express';

const cookieExtractor = (req: Request): string | null => {
  const cookies = (req as any)?.cookies;
  if (cookies && typeof cookies.token === 'string' && cookies.token.length) {
    return cookies.token;
  }
  return null;
};

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    super({
      // 优先 cookie；保留 bearer 仅用于工具脚本/兼容
      jwtFromRequest: ExtractJwt.fromExtractors([
        cookieExtractor,
        ExtractJwt.fromAuthHeaderAsBearerToken(),
      ]),
      ignoreExpiration: false,
      secretOrKey: 'secretKey', // 在实际项目中应使用环境变量
    });
  }

  async validate(payload: any) {
    return { userId: payload.sub, username: payload.username };
  }
}

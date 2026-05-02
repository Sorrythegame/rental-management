import {
  Controller,
  Get,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  Res,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

// 浏览器对 cookie maxAge 上限约 400 天（chrome 104+）。
const COOKIE_MAX_AGE_MS = 400 * 24 * 60 * 60 * 1000;
const COOKIE_NAME = 'token';

const cookieOptions = () => ({
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.COOKIE_SECURE === 'true',
  maxAge: COOKIE_MAX_AGE_MS,
  path: '/',
});

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Get('public-key')
  getPublicKey() {
    return this.authService.getPublicKey();
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() loginDto: { username: string; password: string },
    @Res({ passthrough: true }) res: Response,
  ) {
    const { access_token, username } = await this.authService.login(
      loginDto.username,
      loginDto.password,
    );
    res.cookie(COOKIE_NAME, access_token, cookieOptions());
    return { ok: true, username };
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { ok: true };
  }

  @Get('me')
  me(@Req() req: Request) {
    const user = (req as any).user;
    if (!user) {
      throw new UnauthorizedException();
    }
    return { id: user.userId, username: user.username };
  }
}

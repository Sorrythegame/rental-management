import { Controller, Get, Post, Body, HttpCode, HttpStatus } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from './public.decorator';

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
  login(@Body() loginDto: any) {
    return this.authService.login(loginDto.username, loginDto.password);
  }
}

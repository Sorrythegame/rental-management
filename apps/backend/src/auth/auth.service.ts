import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import NodeRSA from 'node-rsa';

@Injectable()
export class AuthService {
  private key: NodeRSA;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {
    this.key = new NodeRSA({ b: 512 });
    this.key.setOptions({ encryptionScheme: 'pkcs1' });
  }

  getPublicKey() {
    return {
      publicKey: this.key.exportKey('public'),
    };
  }

  async login(username: string, encryptedPassword: string) {
    let password = '';
    try {
      password = this.key.decrypt(encryptedPassword, 'utf8');
    } catch (e) {
      throw new UnauthorizedException('解密失败或密码错误');
    }

    const admin = await this.prisma.admin.findUnique({
      where: { username },
    });

    if (!admin || admin.passwordHash !== password) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload = { username: admin.username, sub: admin.id };
    return {
      access_token: this.jwtService.sign(payload),
    };
  }
}

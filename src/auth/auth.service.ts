import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../users/users.service';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * Phone-OTP based auth. In production, `verifyOtp` should check the code
 * against what was sent via an SMS/OTP provider (e.g. Firebase Auth,
 * MSG91) instead of the stub check below.
 */
@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  async requestOtp(tenantId: string, phone: string): Promise<{ sent: true }> {
    // TODO: integrate with an SMS/OTP provider and store the challenge
    // (e.g. in Redis with a short TTL) keyed by tenantId + phone.
    return { sent: true };
  }

  async verifyOtpAndLogin(tenantId: string, phone: string, otp: string): Promise<TokenPair> {
    // TODO: verify `otp` against the stored challenge before proceeding.
    if (!otp) throw new UnauthorizedException('OTP is required');

    let user = await this.usersService.findByPhone(tenantId, phone);
    if (!user) {
      user = await this.usersService.create(tenantId, {
        phone,
        displayName: 'New User',
        role: 'resident' as any,
      });
    }

    return this.issueTokenPair(user.id, tenantId, user.role);
  }

  async refresh(refreshToken: string): Promise<TokenPair> {
    try {
      const payload = await this.jwtService.verifyAsync(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      });
      return this.issueTokenPair(payload.sub, payload.tenantId, payload.role);
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }

  private async issueTokenPair(userId: string, tenantId: string, role: string): Promise<TokenPair> {
    const payload = { sub: userId, tenantId, role };

    const accessToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_ACCESS_SECRET'),
      expiresIn: this.configService.get<string>('JWT_ACCESS_EXPIRES_IN', '15m'),
    });

    const refreshToken = await this.jwtService.signAsync(payload, {
      secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.configService.get<string>('JWT_REFRESH_EXPIRES_IN', '7d'),
    });

    return { accessToken, refreshToken };
  }
}

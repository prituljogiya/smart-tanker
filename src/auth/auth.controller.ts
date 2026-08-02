import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('otp/request')
  requestOtp(@Body() body: { tenantId: string; phone: string }) {
    return this.authService.requestOtp(body.tenantId, body.phone);
  }

  @Post('otp/verify')
  verifyOtp(@Body() body: { tenantId: string; phone: string; otp: string }) {
    return this.authService.verifyOtpAndLogin(body.tenantId, body.phone, body.otp);
  }

  @Post('refresh')
  refresh(@Body() body: { refreshToken: string }) {
    return this.authService.refresh(body.refreshToken);
  }
}

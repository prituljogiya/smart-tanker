import { Controller, Headers, HttpCode, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  /**
   * Raw body must be preserved (not JSON-parsed) for signature verification -
   * see main.ts, where this route is registered with the raw body parser.
   */
  @Post('webhooks/razorpay')
  @HttpCode(200)
  async razorpayWebhook(@Req() req: Request, @Headers('x-razorpay-signature') signature: string) {
    const rawBody = (req as any).rawBody as string;
    return this.paymentsService.handleWebhook(rawBody, signature);
  }
}

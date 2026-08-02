import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Payment, PaymentGatewayStatus } from './entities/payment.entity';
import { RequestsService } from '../requests/requests.service';

interface RazorpayWebhookPayload {
  event: string;
  payload: {
    payment: {
      entity: {
        id: string;
        amount: number; // in paise
        method: string;
        notes: { requestId: string; tenantId: string; lat: string; lng: string };
      };
    };
  };
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepo: Repository<Payment>,
    private readonly configService: ConfigService,
    private readonly requestsService: RequestsService,
  ) {}

  /** Verifies the X-Razorpay-Signature header before trusting any webhook
   *  payload - required per the architecture doc's payment reliability note. */
  verifySignature(rawBody: string, signatureHeader: string): boolean {
    const secret = this.configService.get<string>('RAZORPAY_WEBHOOK_SECRET');
    if (!secret) throw new Error('RAZORPAY_WEBHOOK_SECRET is not configured');
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signatureHeader));
  }

  async handleWebhook(rawBody: string, signatureHeader: string): Promise<{ ok: true }> {
    if (!this.verifySignature(rawBody, signatureHeader)) {
      throw new UnauthorizedException('Invalid webhook signature');
    }

    const body: RazorpayWebhookPayload = JSON.parse(rawBody);
    if (body.event !== 'payment.captured') return { ok: true };

    const { id, amount, method, notes } = body.payload.payment.entity;

    // Idempotency: if we've already recorded this gateway transaction,
    // do nothing further - webhooks can be delivered more than once.
    const existing = await this.paymentsRepo.findOne({ where: { gatewayTxnId: id } });
    if (existing) return { ok: true };

    const payment = this.paymentsRepo.create({
      tenantId: notes.tenantId,
      requestId: notes.requestId,
      amount: amount / 100,
      gatewayTxnId: id,
      gateway: 'razorpay',
      status: PaymentGatewayStatus.SUCCESS,
      method,
    });
    await this.paymentsRepo.save(payment);

    await this.requestsService.markPaid(
      notes.tenantId,
      notes.requestId,
      parseFloat(notes.lat),
      parseFloat(notes.lng),
    );

    return { ok: true };
  }
}

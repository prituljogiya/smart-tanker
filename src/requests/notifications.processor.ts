import { Process, Processor } from '@nestjs/bull';
import { Logger } from '@nestjs/common';
import { Job } from 'bull';

/**
 * Anything that doesn't need to happen synchronously with the API request
 * (push notifications, alerting a dispatcher, follow-up reminders) runs
 * through this queue instead of blocking the booking/payment flow - see
 * the architecture doc's "event-driven for anything non-instant" principle.
 */
@Processor('notifications')
export class NotificationsProcessor {
  private readonly logger = new Logger(NotificationsProcessor.name);

  @Process('tanker-assigned')
  async handleTankerAssigned(job: Job<{ requestId: string; tankerId: string; residentId: string }>) {
    // TODO: send FCM push to the resident: "Your tanker is on the way"
    this.logger.log(`Tanker ${job.data.tankerId} assigned to request ${job.data.requestId}`);
  }

  @Process('no-tanker-available')
  async handleNoTankerAvailable(job: Job<{ requestId: string }>) {
    // TODO: alert tenant-admin dashboard that this request needs manual assignment
    this.logger.warn(`No tanker available for request ${job.data.requestId}`);
  }

  @Process('delivery-confirmed')
  async handleDeliveryConfirmed(job: Job<{ requestId: string }>) {
    // TODO: send FCM push + generate receipt
    this.logger.log(`Delivery confirmed for request ${job.data.requestId}`);
  }
}

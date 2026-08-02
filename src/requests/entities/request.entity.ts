import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export enum RequestStatus {
  PENDING_PAYMENT = 'pending_payment',
  CONFIRMED = 'confirmed',
  ASSIGNED = 'assigned',
  EN_ROUTE = 'en_route',
  DELIVERED = 'delivered',
  CANCELLED = 'cancelled',
  EXPIRED = 'expired',
}

export enum PaymentStatus {
  NOT_APPLICABLE = 'n/a',
  PENDING = 'pending',
  PAID = 'paid',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('requests')
@Index(['tenantId', 'status'])
export class TankerRequest extends TenantScopedEntity {
  @Column({ name: 'resident_id', type: 'uuid' })
  residentId: string;

  @Column({ name: 'tanker_id', type: 'uuid', nullable: true })
  tankerId: string | null;

  @Column({ name: 'requested_capacity_liters', type: 'int' })
  requestedCapacityLiters: number;

  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: string;

  @Column({ name: 'address_text' })
  addressText: string;

  @Column({ type: 'enum', enum: RequestStatus, default: RequestStatus.PENDING_PAYMENT })
  status: RequestStatus;

  @Column({ name: 'amount_due', type: 'numeric', precision: 10, scale: 2, default: 0 })
  amountDue: number;

  @Column({ name: 'payment_status', type: 'enum', enum: PaymentStatus, default: PaymentStatus.NOT_APPLICABLE })
  paymentStatus: PaymentStatus;

  @Column({ name: 'delivery_otp', type: 'varchar', length: 6, nullable: true })
  deliveryOtp: string | null;

  @Column({ name: 'delivered_at', type: 'timestamptz', nullable: true })
  deliveredAt: Date | null;
}

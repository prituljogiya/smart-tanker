import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export enum PaymentGatewayStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('payments')
@Index(['gatewayTxnId'], { unique: true })
export class Payment extends TenantScopedEntity {
  @Column({ name: 'request_id', type: 'uuid' })
  requestId: string;

  @Column({ type: 'numeric', precision: 10, scale: 2 })
  amount: number;

  @Column({ name: 'gateway_txn_id', type: 'varchar' })
  gatewayTxnId: string;

  @Column({ type: 'varchar', default: 'razorpay' })
  gateway: string;

  @Column({ type: 'enum', enum: PaymentGatewayStatus, default: PaymentGatewayStatus.PENDING })
  status: PaymentGatewayStatus;

  @Column({ type: 'varchar', nullable: true })
  method: string | null;
}

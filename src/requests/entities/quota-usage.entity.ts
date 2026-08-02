import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

/** One row per (tenant, user, month) tracking how many free-quota tankers
 *  a household has used this month, e.g. "2024-07". */
@Entity('quota_usage')
@Index(['tenantId', 'userId', 'month'], { unique: true })
export class QuotaUsage extends TenantScopedEntity {
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 7 })
  month: string;

  @Column({ name: 'tankers_used', type: 'int', default: 0 })
  tankersUsed: number;
}

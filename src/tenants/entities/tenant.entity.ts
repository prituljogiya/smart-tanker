import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export enum TenantType {
  GOVERNMENT = 'government',
  PRIVATE = 'private',
}

/**
 * A Tenant is either a municipal corporation / Jal Board (government) or an
 * independent tanker operator (private). Both run on the same schema and
 * codebase - what differs is `type` and the JSON `rules` config, which the
 * pricing rules engine (see requests/rules-engine.service.ts) reads at
 * booking time to decide whether a request is free, subsidized, or paid.
 */
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: TenantType })
  type: TenantType;

  @Column({ default: true })
  active: boolean;

  /**
   * Free-form per-tenant configuration:
   * {
   *   freeQuotaPerMonth: 2,          // government tenants: free tankers/household/month
   *   subsidizedRate: 50,            // discounted rate for BPL households
   *   commercialRate: 500,           // full rate for commercial/private bookings
   *   currency: "INR"
   * }
   */
  @Column({ type: 'jsonb', default: {} })
  rules: Record<string, any>;

  @Column({ name: 'branding_config', type: 'jsonb', default: {} })
  brandingConfig: Record<string, any>;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

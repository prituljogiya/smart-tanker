import { CreateDateColumn, Column, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * Base class for every entity that belongs to a tenant (a government body
 * or a private operator). `tenantId` is indexed and is the column that
 * PostgreSQL row-level security policies filter on - see
 * migrations/1700000000000-InitialSchema.ts for the RLS policy definitions.
 */
export abstract class TenantScopedEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'tenant_id' })
  tenantId: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

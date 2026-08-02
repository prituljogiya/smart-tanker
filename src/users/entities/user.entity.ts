import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';
import { EncryptedColumn } from '../../common/transformers/encrypted-column.transformer';
import { Role } from '../../auth/enums/role.enum';

export enum HouseholdCategory {
  RESIDENTIAL = 'residential',
  BPL = 'bpl',
  COMMERCIAL = 'commercial',
}

@Entity('users')
@Index(['tenantId', 'phoneHash'], { unique: true })
export class User extends TenantScopedEntity {
  @Column({ type: 'enum', enum: Role })
  role: Role;

  @Column({ name: 'display_name' })
  displayName: string;

  /**
   * Phone number is encrypted at rest (AES-256-GCM via EncryptedColumn).
   * `phoneHash` is a deterministic SHA-256 hash used only for lookups
   * (e.g. "does this phone number already exist for this tenant") since
   * the encrypted value itself is non-deterministic and can't be indexed.
   */
  @Column({ name: 'phone_encrypted', type: 'text', transformer: EncryptedColumn })
  phone: string;

  @Column({ name: 'phone_hash', type: 'varchar', length: 64 })
  phoneHash: string;

  @Column({ name: 'address_encrypted', type: 'text', transformer: EncryptedColumn, nullable: true })
  address: string | null;

  @Column({
    type: 'enum',
    enum: HouseholdCategory,
    name: 'household_category',
    nullable: true,
  })
  householdCategory: HouseholdCategory | null;

  @Column({ name: 'password_hash', type: 'varchar', nullable: true })
  passwordHash: string | null;

  @Column({ default: true })
  active: boolean;
}

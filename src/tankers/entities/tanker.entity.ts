import { Column, Entity, Index } from 'typeorm';
import { TenantScopedEntity } from '../../common/entities/tenant-scoped.entity';

export enum TankerStatus {
  AVAILABLE = 'available',
  EN_ROUTE = 'en_route',
  DELIVERING = 'delivering',
  OFFLINE = 'offline',
}

@Entity('tankers')
@Index(['tenantId', 'status'])
export class Tanker extends TenantScopedEntity {
  @Column({ name: 'vehicle_number' })
  vehicleNumber: string;

  @Column({ name: 'capacity_liters', type: 'int' })
  capacityLiters: number;

  @Column({ name: 'driver_id', type: 'uuid', nullable: true })
  driverId: string | null;

  @Column({ type: 'enum', enum: TankerStatus, default: TankerStatus.OFFLINE })
  status: TankerStatus;

  /**
   * Last known position, kept in sync from the high-frequency location_logs
   * stream so a simple lookup here (rather than scanning location_logs)
   * is enough to answer "nearest available tanker" queries via PostGIS.
   */
  @Column({ name: 'last_location', type: 'geography', spatialFeatureType: 'Point', srid: 4326, nullable: true })
  lastLocation: string | null;

  @Column({ name: 'last_location_at', type: 'timestamptz', nullable: true })
  lastLocationAt: Date | null;
}

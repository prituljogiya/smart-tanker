import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tanker, TankerStatus } from './entities/tanker.entity';

@Injectable()
export class TankersService {
  constructor(
    @InjectRepository(Tanker)
    private readonly tankersRepo: Repository<Tanker>,
  ) {}

  async findById(tenantId: string, id: string): Promise<Tanker> {
    const tanker = await this.tankersRepo.findOne({ where: { tenantId, id } });
    if (!tanker) throw new NotFoundException(`Tanker ${id} not found`);
    return tanker;
  }

  async findFleet(tenantId: string): Promise<Tanker[]> {
    return this.tankersRepo.find({ where: { tenantId } });
  }

  async updateLocation(tenantId: string, id: string, lat: number, lng: number): Promise<void> {
    await this.tankersRepo
      .createQueryBuilder()
      .update(Tanker)
      .set({
        lastLocation: () => `ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)`,
        lastLocationAt: new Date(),
      })
      .where('tenant_id = :tenantId AND id = :id', { tenantId, id })
      .execute();
  }

  /**
   * PostGIS nearest-neighbor query: returns the closest available tankers
   * to a given point, using the <-> distance operator against the
   * geography index on last_location. This backs auto-assignment for
   * incoming requests.
   */
  async findNearestAvailable(tenantId: string, lat: number, lng: number, limit = 5): Promise<Tanker[]> {
    return this.tankersRepo
      .createQueryBuilder('tanker')
      .where('tanker.tenant_id = :tenantId', { tenantId })
      .andWhere('tanker.status = :status', { status: TankerStatus.AVAILABLE })
      .andWhere('tanker.last_location IS NOT NULL')
      .orderBy(`tanker.last_location <-> ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography`)
      .setParameters({ lat, lng })
      .limit(limit)
      .getMany();
  }

  async setStatus(tenantId: string, id: string, status: TankerStatus): Promise<Tanker> {
    const tanker = await this.findById(tenantId, id);
    tanker.status = status;
    return this.tankersRepo.save(tanker);
  }
}

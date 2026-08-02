import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

@Injectable()
export class TenantsService {
  constructor(
    @InjectRepository(Tenant)
    private readonly tenantsRepo: Repository<Tenant>,
  ) {}

  async findById(id: string): Promise<Tenant> {
    const tenant = await this.tenantsRepo.findOne({ where: { id } });
    if (!tenant) throw new NotFoundException(`Tenant ${id} not found`);
    return tenant;
  }

  async findAll(): Promise<Tenant[]> {
    return this.tenantsRepo.find();
  }

  async create(data: Partial<Tenant>): Promise<Tenant> {
    const tenant = this.tenantsRepo.create(data);
    return this.tenantsRepo.save(tenant);
  }

  async updateRules(id: string, rules: Record<string, any>): Promise<Tenant> {
    const tenant = await this.findById(id);
    tenant.rules = { ...tenant.rules, ...rules };
    return this.tenantsRepo.save(tenant);
  }
}

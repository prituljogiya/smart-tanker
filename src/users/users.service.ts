import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepo: Repository<User>,
  ) {}

  /** Deterministic hash used only to look up users by phone number; the
   *  actual phone number is stored encrypted (see EncryptedColumn). */
  static hashPhone(phone: string): string {
    return crypto.createHash('sha256').update(phone).digest('hex');
  }

  async findByPhone(tenantId: string, phone: string): Promise<User | null> {
    const phoneHash = UsersService.hashPhone(phone);
    return this.usersRepo.findOne({ where: { tenantId, phoneHash } });
  }

  async findById(tenantId: string, id: string): Promise<User> {
    const user = await this.usersRepo.findOne({ where: { tenantId, id } });
    if (!user) throw new NotFoundException(`User ${id} not found`);
    return user;
  }

  async create(tenantId: string, data: Partial<User> & { phone: string }): Promise<User> {
    const user = this.usersRepo.create({
      ...data,
      tenantId,
      phoneHash: UsersService.hashPhone(data.phone),
    });
    return this.usersRepo.save(user);
  }
}

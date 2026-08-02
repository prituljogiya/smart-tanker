import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from '../tenants/entities/tenant.entity';
import { User, HouseholdCategory } from '../users/entities/user.entity';
import { QuotaUsage } from './entities/quota-usage.entity';

export interface PricingDecision {
  amountDue: number;
  reason: 'free_quota' | 'subsidized' | 'commercial_rate' | 'paid_quota_exceeded';
}

/**
 * Central pricing decision point. Both the government free/subsidized
 * model and the private fully-commercial model run through this same
 * function - only the tenant's `rules` JSON config differs. This is what
 * lets one codebase serve both go-to-market motions (see the operating
 * model doc, section 6).
 */
@Injectable()
export class RulesEngineService {
  constructor(
    @InjectRepository(QuotaUsage)
    private readonly quotaRepo: Repository<QuotaUsage>,
  ) {}

  async computePrice(
    tenant: Tenant,
    user: User,
    requestedCapacityLiters: number,
  ): Promise<PricingDecision> {
    const rules = tenant.rules || {};

    // Commercial/private-operator requests, or commercial-category households,
    // always pay the commercial rate - no free quota applies.
    if (user.householdCategory === HouseholdCategory.COMMERCIAL || !rules.freeQuotaPerMonth) {
      return {
        amountDue: this.rateFor(rules, requestedCapacityLiters, 'commercialRate'),
        reason: 'commercial_rate',
      };
    }

    const month = new Date().toISOString().slice(0, 7); // "YYYY-MM"
    const usage = await this.getOrCreateUsage(tenant.id, user.id, month);

    if (usage.tankersUsed < rules.freeQuotaPerMonth) {
      usage.tankersUsed += 1;
      await this.quotaRepo.save(usage);
      return { amountDue: 0, reason: 'free_quota' };
    }

    if (user.householdCategory === HouseholdCategory.BPL && rules.subsidizedRate) {
      return {
        amountDue: this.rateFor(rules, requestedCapacityLiters, 'subsidizedRate'),
        reason: 'subsidized',
      };
    }

    return {
      amountDue: this.rateFor(rules, requestedCapacityLiters, 'commercialRate'),
      reason: 'paid_quota_exceeded',
    };
  }

  private rateFor(rules: Record<string, any>, liters: number, key: string): number {
    const perThousandLiters = rules[key] ?? 0;
    return Math.round((liters / 1000) * perThousandLiters * 100) / 100;
  }

  private async getOrCreateUsage(tenantId: string, userId: string, month: string): Promise<QuotaUsage> {
    let usage = await this.quotaRepo.findOne({ where: { tenantId, userId, month } });
    if (!usage) {
      usage = this.quotaRepo.create({ tenantId, userId, month, tankersUsed: 0 });
      usage = await this.quotaRepo.save(usage);
    }
    return usage;
  }
}

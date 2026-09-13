import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type SchoolType = 'PRIMARY' | 'SECONDARY';
export type Tier = 'BASIC' | 'STANDARD' | 'PREMIUM';
export type Interval = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';

const SCHOOL_TYPES: SchoolType[] = ['PRIMARY', 'SECONDARY'];
const TIERS: Tier[] = ['BASIC', 'STANDARD', 'PREMIUM'];
const INTERVALS: Interval[] = ['MONTHLY', 'QUARTERLY', 'ANNUAL'];

const DEFAULT_PRICING: Record<SchoolType, Record<Tier, Record<Interval, { priceUsd: number; priceZwK: number }>>> = {
  SECONDARY: {
    BASIC: {
      MONTHLY: { priceUsd: 5, priceZwK: 150 },
      QUARTERLY: { priceUsd: 13, priceZwK: 390 },
      ANNUAL: { priceUsd: 48, priceZwK: 1440 },
    },
    STANDARD: {
      MONTHLY: { priceUsd: 12, priceZwK: 360 },
      QUARTERLY: { priceUsd: 32, priceZwK: 960 },
      ANNUAL: { priceUsd: 110, priceZwK: 3300 },
    },
    PREMIUM: {
      MONTHLY: { priceUsd: 25, priceZwK: 750 },
      QUARTERLY: { priceUsd: 65, priceZwK: 1950 },
      ANNUAL: { priceUsd: 220, priceZwK: 6600 },
    },
  },
  PRIMARY: {
    BASIC: {
      MONTHLY: { priceUsd: 3, priceZwK: 90 },
      QUARTERLY: { priceUsd: 8, priceZwK: 240 },
      ANNUAL: { priceUsd: 27, priceZwK: 810 },
    },
    STANDARD: {
      MONTHLY: { priceUsd: 8, priceZwK: 240 },
      QUARTERLY: { priceUsd: 21, priceZwK: 630 },
      ANNUAL: { priceUsd: 70, priceZwK: 2100 },
    },
    PREMIUM: {
      MONTHLY: { priceUsd: 15, priceZwK: 450 },
      QUARTERLY: { priceUsd: 40, priceZwK: 1200 },
      ANNUAL: { priceUsd: 130, priceZwK: 3900 },
    },
  },
};

const TIER_FEATURES: Record<Tier, string[]> = {
  BASIC: [
    'Student management (up to 200 students)',
    'Attendance tracking',
    'Digital grade book',
    'Parent communications',
    'Email support',
  ],
  STANDARD: [
    'Everything in Basic',
    'Smart timetable generation',
    'Report cards & transcripts',
    'SMS notifications',
    'Assessment & exams module',
    'Priority support',
  ],
  PREMIUM: [
    'Everything in Standard',
    'Unlimited students & teachers',
    'AI-powered analytics',
    'Digital stamps & certifications',
    'API access & integrations',
    'Dedicated account manager',
  ],
};

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  private assertSchoolType(value: string): SchoolType {
    if (!SCHOOL_TYPES.includes(value as SchoolType)) {
      throw new BadRequestException(`Invalid schoolType: ${value}. Expected ${SCHOOL_TYPES.join(', ')}`);
    }
    return value as SchoolType;
  }

  private assertTier(value: string): Tier {
    if (!TIERS.includes(value as Tier)) {
      throw new BadRequestException(`Invalid tier: ${value}. Expected ${TIERS.join(', ')}`);
    }
    return value as Tier;
  }

  private assertInterval(value: string): Interval {
    if (!INTERVALS.includes(value as Interval)) {
      throw new BadRequestException(`Invalid interval: ${value}. Expected ${INTERVALS.join(', ')}`);
    }
    return value as Interval;
  }

  async getCatalog() {
    const rows = await this.prisma.planPricing.findMany({
      where: { isActive: true },
      orderBy: [{ schoolType: 'asc' }, { tier: 'asc' }, { interval: 'asc' }],
    });

    const catalog: Record<
      string,
      Record<Tier, Record<Interval, { id: string; priceUsd: number; priceZwK: number; features: string[] }>>
    > = {
      secondary: {} as never,
      primary: {} as never,
    };

    for (const key of SCHOOL_TYPES) {
      const groupKey = key === 'SECONDARY' ? 'secondary' : 'primary';
      catalog[groupKey] = {} as never;
      for (const tier of TIERS) {
        if (!catalog[groupKey][tier]) catalog[groupKey][tier] = {} as never;
      }
    }

    for (const row of rows) {
      const groupKey = row.schoolType === 'SECONDARY' ? 'secondary' : 'primary';
      catalog[groupKey][row.tier as Tier][row.interval as Interval] = {
        id: row.id,
        priceUsd: row.priceUsd,
        priceZwK: row.priceZwK,
        features: Array.isArray(row.features) ? row.features : [],
      };
    }

    return catalog;
  }

  async list() {
    return this.prisma.planPricing.findMany({
      orderBy: [{ schoolType: 'asc' }, { tier: 'asc' }, { interval: 'asc' }],
    });
  }

  async upsert(body: {
    schoolType: string;
    tier: string;
    interval: string;
    priceUsd?: number;
    priceZwK?: number;
    features?: string[];
    isActive?: boolean;
  }) {
    const schoolType = this.assertSchoolType(body.schoolType);
    const tier = this.assertTier(body.tier);
    const interval = this.assertInterval(body.interval);

    return this.prisma.planPricing.upsert({
      where: { schoolType_tier_interval: { schoolType, tier, interval } },
      create: {
        schoolType,
        tier,
        interval,
        priceUsd: body.priceUsd ?? 0,
        priceZwK: body.priceZwK ?? 0,
        features: body.features ?? TIER_FEATURES[tier],
        isActive: body.isActive ?? true,
      },
      update: {
        priceUsd: body.priceUsd,
        priceZwK: body.priceZwK,
        features: body.features,
        isActive: body.isActive,
      },
    });
  }

  async update(
    id: string,
    body: {
      priceUsd?: number;
      priceZwK?: number;
      features?: string[];
      isActive?: boolean;
    },
  ) {
    const existing = await this.prisma.planPricing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pricing entry not found');
    return this.prisma.planPricing.update({
      where: { id },
      data: {
        ...(body.priceUsd !== undefined ? { priceUsd: body.priceUsd } : {}),
        ...(body.priceZwK !== undefined ? { priceZwK: body.priceZwK } : {}),
        ...(body.features !== undefined ? { features: body.features } : {}),
        ...(body.isActive !== undefined ? { isActive: body.isActive } : {}),
      },
    });
  }

  async remove(id: string) {
    const existing = await this.prisma.planPricing.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Pricing entry not found');
    return this.prisma.planPricing.delete({ where: { id } });
  }

  async seedDefaults() {
    const created: number[] = [];
    for (const schoolType of SCHOOL_TYPES) {
      for (const tier of TIERS) {
        for (const interval of INTERVALS) {
          const { priceUsd, priceZwK } = DEFAULT_PRICING[schoolType][tier][interval];
          const existing = await this.prisma.planPricing.findUnique({
            where: { schoolType_tier_interval: { schoolType, tier, interval } },
          });
          if (!existing) {
            await this.prisma.planPricing.create({
              data: {
                schoolType,
                tier,
                interval,
                priceUsd,
                priceZwK,
                features: TIER_FEATURES[tier],
                isActive: true,
              },
            });
            created.push(1);
          }
        }
      }
    }
    const rows = await this.prisma.planPricing.count();
    return { created: created.length, total: rows };
  }
}
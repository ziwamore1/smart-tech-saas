import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HolidayService {
  private readonly logger = new Logger(HolidayService.name);

  constructor(private prisma: PrismaService) {}

  async create(schoolId: string, data: {
    name: string;
    description?: string;
    startDate: string;
    endDate: string;
    type?: string;
    isRecurring?: boolean;
  }) {
    const start = new Date(data.startDate);
    const end = new Date(data.endDate);

    if (end < start) {
      throw new BadRequestException('End date must be after start date');
    }

    // Check for overlapping holidays
    const overlapping = await this.prisma.holiday.findFirst({
      where: {
        schoolId,
        OR: [
          { startDate: { lte: end }, endDate: { gte: start } },
        ],
      },
    });

    if (overlapping) {
      throw new BadRequestException(`Overlaps with existing holiday: "${overlapping.name}"`);
    }

    return this.prisma.holiday.create({
      data: {
        name: data.name,
        description: data.description,
        startDate: start,
        endDate: end,
        type: data.type || 'PUBLIC',
        isRecurring: data.isRecurring || false,
        schoolId,
      },
    });
  }

  async findAll(schoolId: string, filters?: { type?: string; year?: number }) {
    const where: any = { schoolId };

    if (filters?.type) {
      where.type = filters.type;
    }

    if (filters?.year) {
      const yearStart = new Date(filters.year, 0, 1);
      const yearEnd = new Date(filters.year, 11, 31);
      where.OR = [
        { startDate: { gte: yearStart, lte: yearEnd } },
        { endDate: { gte: yearStart, lte: yearEnd } },
        { isRecurring: true },
      ];
    }

    return this.prisma.holiday.findMany({
      where,
      orderBy: { startDate: 'asc' },
    });
  }

  async findOne(id: string, schoolId: string) {
    const holiday = await this.prisma.holiday.findFirst({
      where: { id, schoolId },
    });

    if (!holiday) {
      throw new NotFoundException('Holiday not found');
    }

    return holiday;
  }

  async update(id: string, schoolId: string, data: {
    name?: string;
    description?: string;
    startDate?: string;
    endDate?: string;
    type?: string;
    isRecurring?: boolean;
  }) {
    await this.findOne(id, schoolId);

    const updateData: any = {};
    if (data.name) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.startDate) updateData.startDate = new Date(data.startDate);
    if (data.endDate) updateData.endDate = new Date(data.endDate);
    if (data.type) updateData.type = data.type;
    if (data.isRecurring !== undefined) updateData.isRecurring = data.isRecurring;

    return this.prisma.holiday.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, schoolId: string) {
    await this.findOne(id, schoolId);

    return this.prisma.holiday.delete({
      where: { id },
    });
  }

  /**
   * Check if a specific date is a holiday for the given school.
   * Handles recurring holidays (checks month/day match) and date range holidays.
   */
  async isHoliday(schoolId: string, date: Date): Promise<{ isHoliday: boolean; holiday?: any }> {
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    // Check date-range holidays
    const rangeHoliday = await this.prisma.holiday.findFirst({
      where: {
        schoolId,
        startDate: { lte: endOfDay },
        endDate: { gte: startOfDay },
      },
    });

    if (rangeHoliday) {
      return { isHoliday: true, holiday: rangeHoliday };
    }

    // Check recurring holidays (same month and day)
    const month = date.getMonth() + 1;
    const day = date.getDate();

    const recurringHolidays = await this.prisma.holiday.findMany({
      where: {
        schoolId,
        isRecurring: true,
      },
    });

    for (const h of recurringHolidays) {
      const hStart = new Date(h.startDate);
      if (hStart.getMonth() + 1 === month && hStart.getDate() === day) {
        return { isHoliday: true, holiday: h };
      }
      // For multi-day recurring holidays, check if date falls within the range
      if (h.startDate && h.endDate) {
        const hEnd = new Date(h.endDate);
        const thisYear = date.getFullYear();
        const rangeStart = new Date(thisYear, hStart.getMonth(), hStart.getDate());
        const rangeEnd = new Date(thisYear, hEnd.getMonth(), hEnd.getDate());
        if (date >= rangeStart && date <= rangeEnd) {
          return { isHoliday: true, holiday: h };
        }
      }
    }

    return { isHoliday: false };
  }

  /**
   * Get all holidays in a date range (for attendance register context).
   */
  async getHolidaysInRange(schoolId: string, startDate: Date, endDate: Date) {
    return this.prisma.holiday.findMany({
      where: {
        schoolId,
        OR: [
          { startDate: { lte: endDate }, endDate: { gte: startDate } },
        ],
      },
      orderBy: { startDate: 'asc' },
    });
  }

  /**
   * Bulk create Zambian national holidays for a given year.
   */
  async seedNationalHolidays(schoolId: string, year: number) {
    const holidays = [
      { name: "New Year's Day", month: 1, day: 1, type: 'PUBLIC' },
      { name: "Women's Day", month: 3, day: 8, type: 'PUBLIC' },
      { name: "Youth Day", month: 3, day: 12, type: 'PUBLIC' },
      { name: "Good Friday", month: 4, day: 0, type: 'RELIGIOUS' }, // varies, placeholder
      { name: "Holy Saturday", month: 4, day: 0, type: 'RELIGIOUS' },
      { name: "Easter Monday", month: 4, day: 0, type: 'RELIGIOUS' },
      { name: "Freedom Day", month: 4, day: 28, type: 'PUBLIC' },
      { name: "Labour Day", month: 5, day: 1, type: 'PUBLIC' },
      { name: "Africa Freedom Day", month: 5, day: 25, type: 'PUBLIC' },
      { name: "Heroes' Day", month: 7, day: 1, type: 'PUBLIC' },
      { name: "Unity Day", month: 7, day: 2, type: 'PUBLIC' },
      { name: "Farmers' Day", month: 8, day: 2, type: 'PUBLIC' },
      { name: "National Prayer Day", month: 10, day: 18, type: 'PUBLIC' },
      { name: "Independence Day", month: 10, day: 24, type: 'PUBLIC' },
      { name: "Christmas Day", month: 12, day: 25, type: 'PUBLIC' },
    ];

    const created = [];
    const skipped = [];

    for (const h of holidays) {
      if (h.day === 0) {
        skipped.push({ name: h.name, reason: 'Variable date (Easter) - must be set manually' });
        continue;
      }

      const startDate = new Date(year, h.month - 1, h.day);
      const endDate = new Date(year, h.month - 1, h.day);

      const existing = await this.prisma.holiday.findFirst({
        where: {
          schoolId,
          name: h.name,
          startDate: { gte: new Date(year, 0, 1), lte: new Date(year, 11, 31) },
        },
      });

      if (existing) {
        skipped.push({ name: h.name, reason: 'Already exists' });
        continue;
      }

      const created_holiday = await this.prisma.holiday.create({
        data: {
          name: h.name,
          startDate,
          endDate,
          type: h.type,
          isRecurring: true,
          schoolId,
        },
      });

      created.push(created_holiday);
    }

    return { created: created.length, skipped: skipped.length, details: { created, skipped } };
  }
}

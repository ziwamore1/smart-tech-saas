export interface TimeslotModel {
  day: number;
  period: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
}

export interface TimeslotConfig {
  days: number;
  periods: number;
  breakPeriods: { day: number; period: number }[];
  timeslots: TimeslotModel[];
}

export interface TimeslotRegistry {
  get(day: number, period: number): TimeslotModel | undefined;
  getAll(): TimeslotModel[];
  getAvailable(): { day: number; period: number }[];
  isBreak(day: number, period: number): boolean;
  getConfig(): TimeslotConfig;
}

export function createTimeslotRegistry(config?: Partial<TimeslotConfig>): TimeslotRegistry {
  const defaultConfig: TimeslotConfig = {
    days: config?.days ?? 5,
    periods: config?.periods ?? 8,
    breakPeriods: config?.breakPeriods ?? [],
    timeslots: config?.timeslots ?? [],
  };

  const timeslots: TimeslotModel[] = [];
  const breakSet = new Set<string>();

  for (let day = 1; day <= defaultConfig.days; day++) {
    for (let period = 1; period <= defaultConfig.periods; period++) {
      const isBreak = defaultConfig.breakPeriods.some(
        b => b.day === day && b.period === period
      );
      timeslots.push({
        day,
        period,
        startTime: `${period}:00`,
        endTime: `${period}:45`,
        isBreak,
      });
      if (isBreak) {
        breakSet.add(`${day}-${period}`);
      }
    }
  }

  return {
    get(day: number, period: number) {
      return timeslots.find(t => t.day === day && t.period === period);
    },
    getAll() {
      return timeslots;
    },
    getAvailable() {
      const available: { day: number; period: number }[] = [];
      for (let day = 1; day <= defaultConfig.days; day++) {
        for (let period = 1; period <= defaultConfig.periods; period++) {
          if (!breakSet.has(`${day}-${period}`)) {
            available.push({ day, period });
          }
        }
      }
      return available;
    },
    isBreak(day: number, period: number) {
      return breakSet.has(`${day}-${period}`);
    },
    getConfig() {
      return defaultConfig;
    },
  };
}
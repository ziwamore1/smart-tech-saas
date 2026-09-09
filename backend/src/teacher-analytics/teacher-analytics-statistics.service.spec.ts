import {
  AT_RISK_AVERAGE_THRESHOLD,
  DISTINCTION_THRESHOLD,
  PASS_THRESHOLD,
  TREND_SENSITIVITY,
  TeacherAnalyticsStatisticsService,
} from './teacher-analytics-statistics.service';

describe('TeacherAnalyticsStatisticsService', () => {
  const service = new TeacherAnalyticsStatisticsService();

  it('uses the shared pass and distinction thresholds', () => {
    expect(PASS_THRESHOLD).toBe(50);
    expect(DISTINCTION_THRESHOLD).toBe(75);
    expect(AT_RISK_AVERAGE_THRESHOLD).toBe(40);
    expect(TREND_SENSITIVITY).toBe(3);
  });

  it('calculates descriptive statistics and handles empty input', () => {
    expect(service.scoreStats([20, 50, 80])).toEqual({
      count: 3,
      average: 50,
      median: 50,
      highest: 80,
      lowest: 20,
      stdDev: 24.49,
      passRate: 66.67,
      failRate: 33.33,
      distinctionRate: 33.33,
      creditRate: 33.33,
    });
    expect(service.scoreStats([])).toEqual({
      count: 0,
      average: null,
      median: null,
      highest: null,
      lowest: null,
      stdDev: null,
      passRate: null,
      failRate: null,
      distinctionRate: null,
      creditRate: null,
    });
  });

  it('classifies score distributions and trends at the configured boundaries', () => {
    const distribution = service.distribution([39, 40, 49, 50, 74, 75]);
    expect(distribution.map((band) => band.count)).toEqual([1, 2, 1, 0, 1, 1]);
    expect(distribution.map((band) => band.percentage)).toEqual([16.67, 33.33, 16.67, 0, 16.67, 16.67]);
    expect(service.trendLabel(3)).toBe('STABLE');
    expect(service.trendLabel(3.01)).toBe('IMPROVING');
    expect(service.trendLabel(-3.01)).toBe('DECLINING');
    expect(service.trendLabel(null)).toBe('INSUFFICIENT_DATA');
  });

  it('calculates gender gaps without inferring missing groups', () => {
    expect(service.genderGap(60, 65, 70, 75)).toMatchObject({
      averageGap: 5,
      passRateGap: 5,
      classification: 'MALE_ADVANTAGE',
    });
    expect(service.genderGap(null, 65, 70, 75).classification).toBe('INSUFFICIENT_DATA');
    expect(service.genderGap(60, 61, 70, 71).classification).toBe('NEGLIGIBLE_GAP');
  });

  it('classifies quality against participation and preserves missing-data state', () => {
    expect(service.qualityQuantity(80, 70).quadrant).toBe('HIGH_QUANTITY_HIGH_QUALITY');
    expect(service.qualityQuantity(80, 40).quadrant).toBe('HIGH_QUANTITY_LOW_QUALITY');
    expect(service.qualityQuantity(null, 40).label).toContain('Insufficient data');
  });
});

import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class AnalyticsClientService {
  private readonly logger = new Logger(AnalyticsClientService.name);
  private client;

  constructor() {
    const baseURL = process.env.ANALYTICS_SERVICE_URL || 'http://localhost:8000';
    this.client = axios.create({
      baseURL: `${baseURL}/api/v2/analytics`,
      timeout: 30000,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  private async post(endpoint: string, data: any): Promise<any> {
    try {
      const res = await this.client.post(endpoint, data);
      return res.data;
    } catch (err: any) {
      this.logger.error(`Analytics API error [${endpoint}]: ${err.message}`);
      throw err;
    }
  }

  async descriptiveStats(scores: number[]) {
    return this.post('/descriptive-stats', { scores });
  }

  async percentiles(scores: number[], studentId?: string) {
    return this.post('/percentiles', { scores, student_id: studentId });
  }

  async zScores(scores: number[]) {
    return this.post('/z-scores', { scores });
  }

  async histogram(scores: number[], bins = 10) {
    return this.post('/histogram', { scores, bins });
  }

  async outliers(scores: number[]) {
    return this.post('/outliers', { scores });
  }

  async linearTrend(dataPoints: number[], labels?: string[]) {
    return this.post('/trends/linear', { data_points: dataPoints, labels });
  }

  async performanceTrend(dataPoints: number[]) {
    return this.post('/trends/performance', { data_points: dataPoints });
  }

  async subjectCorrelations(subjectScores: Record<string, number[]>) {
    return this.post('/correlations/subjects', { subject_scores: subjectScores });
  }

  async attendanceCorrelation(attendanceRates: number[], scores: number[]) {
    return this.post('/correlations/attendance', { attendance_rates: attendanceRates, scores });
  }

  async subjectClusters(subjectScores: Record<string, number[]>) {
    return this.post('/correlations/cluster', { subject_scores: subjectScores });
  }

  async riskPrediction(features: Record<string, any>[]) {
    return this.post('/predictive/risk', { features });
  }

  async dropoutPrediction(historicalGpas: number[], attendanceRates: number[], currentScores: number[]) {
    return this.post('/predictive/dropout', {
      historical_gpas: historicalGpas,
      attendance_rates: attendanceRates,
      current_scores: currentScores,
    });
  }

  async competencyDiagnosis(competencyScores: Record<string, number>) {
    return this.post('/diagnostic/competency', { competency_scores: competencyScores });
  }

  async weaknessAnalysis(subjectScores: Record<string, number>) {
    return this.post('/diagnostic/weaknesses', { subject_scores: subjectScores });
  }

  async crossSubjectDiagnosis(subjectScores: Record<string, number>) {
    return this.post('/diagnostic/cross-subject', { subject_scores: subjectScores });
  }

  async studentRecommendations(subjectScores: Record<string, number>, strengths?: string[], weaknesses?: string[]) {
    return this.post('/recommendations/student', { subject_scores: subjectScores, strengths, weaknesses });
  }

  async benchmarkingCompare(schoolScores: number[], nationalScores: number[]) {
    return this.post('/benchmarking/compare', { school_scores: schoolScores, national_scores: nationalScores });
  }

  async itemAnalysis(responses: number[][], totalScores?: number[]) {
    return this.post('/psychometric/item-analysis', { responses, total_scores: totalScores });
  }

  async reliability(responses: number[][]) {
    return this.post('/psychometric/reliability', { responses });
  }

  async difficultyDistribution(responses: number[][]) {
    return this.post('/psychometric/difficulty-distribution', { responses });
  }

  async scoreDistribution(scores: number[]) {
    return this.post('/psychometric/score-distribution', { scores });
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.client.get('/health');
      return true;
    } catch {
      return false;
    }
  }
}

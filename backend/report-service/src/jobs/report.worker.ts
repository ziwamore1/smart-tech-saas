import { Worker, Job } from 'bullmq';
import { config } from '../config';
import { DataFetcher } from '../data/fetcher';
import { ReportRenderer } from '../render/engine';
import { PdfStorage } from '../storage/pdf-storage';
import { ReportJobData, ReportResult } from '../types';

export class ReportWorker {
  private worker: Worker;
  private fetcher: DataFetcher;
  private renderer: ReportRenderer;
  private storage: PdfStorage;
  private lastRedisErrorLog = 0;

  constructor() {
    this.fetcher = new DataFetcher();
    this.renderer = new ReportRenderer();
    this.storage = new PdfStorage();

    this.worker = new Worker<ReportJobData>(
      config.queue.name,
      async (job: Job<ReportJobData>) => {
        return this.processJob(job);
      },
      {
        connection: config.redis!,
        concurrency: config.queue.concurrency,
      },
    );

    this.worker.on('completed', (job: Job) => {
      console.log(`✅ Job ${job.id} completed successfully`);
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      console.error(`❌ Job ${job?.id} failed:`, error.message || error);
    });

    this.worker.on('error', (error: Error) => {
      if (Date.now() - this.lastRedisErrorLog > 30_000) {
        this.lastRedisErrorLog = Date.now();
        console.error('Report worker Redis connection error:', error.message || error);
      }
    });

    console.log(`📋 Report worker started, listening on queue: ${config.queue.name}`);
    console.log(`   Concurrency: ${config.queue.concurrency}`);
  }

  private async processJob(job: Job<ReportJobData>): Promise<ReportResult> {
    const { type, schoolId, params, jobId } = job.data;
    const startTime = Date.now();

    console.log(`📄 Generating ${type} for school ${schoolId} (job: ${jobId})`);

    await job.updateProgress(10);
    const data = await this.fetcher.fetchData(type, schoolId, params);

    await job.updateProgress(40);

    let buffer: Buffer;
    switch (type) {
      case 'report-card':
        buffer = await this.renderer.renderReportCard(data);
        break;
      case 'transcript':
        buffer = await this.renderer.renderTranscript(data);
        break;
      case 'analytics-summary':
        buffer = await this.renderer.renderAnalyticsSummary(data);
        break;
      case 'performance-profile':
        buffer = await this.renderer.renderPerformanceProfile(data);
        break;
      default:
        throw new Error(`Unknown report type: ${type}`);
    }

    await job.updateProgress(80);

    const result = this.storage.savePdf(schoolId, jobId, buffer);

    const duration = Date.now() - startTime;
    console.log(`✅ ${type} generated in ${duration}ms (${(buffer.length / 1024).toFixed(1)}KB)`);

    await job.updateProgress(100);
    return result;
  }

  async shutdown() {
    await this.worker.close();
    await this.renderer.shutdown();
    console.log('👋 Report worker shut down');
  }
}

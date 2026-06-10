import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Processor('cloudinary-cleanup')
export class CloudinaryCleanupWorker extends WorkerHost {
  constructor(private cloudinary: CloudinaryService) {
    super();
  }

  async process(job: Job<{ publicIds: string[] }>): Promise<{ deleted: number; failed: string[] }> {
    const { publicIds } = job.data;
    const results = await Promise.allSettled(
      publicIds.map(publicId => this.cloudinary.delete(publicId)),
    );
    const failed: string[] = [];
    results.forEach((r, i) => {
      if (r.status === 'rejected') failed.push(publicIds[i]);
    });
    return { deleted: results.length - failed.length, failed };
  }
}

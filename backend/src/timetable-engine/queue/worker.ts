import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import * as os from 'os';
import { 
  timetableQueue, 
  TimetableJobData, 
  TimetableJobResult 
} from './queue';
import { solveDistributed } from '../solver/parallelSolver';
import { Lesson } from '../solver/fastCSPSolver';
import { SlotIndex } from '../entities/cache';

const connection = new IORedis(process.env.REDIS_URL!, {
  tls: {
    rejectUnauthorized: false,
  },
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    return Math.min(times * 200, 2000);
  },
});

const numWorkers = Math.max(1, os.cpus().length - 1);

console.log(`Starting ${numWorkers} solver workers...`);

const createSolverWorker = (workerId: number) => {
  const worker = new Worker<TimetableJobData, TimetableJobResult>(
    'timetable',
    async (job) => {
      console.log(`[Worker ${workerId}] Processing job ${job.id}`);
      
      const startTime = Date.now();
      const { lessons, slots, config, weights } = job.data;

      try {
        const result = await solveDistributed(
          lessons as Lesson[], 
          slots as SlotIndex[], 
          {
            workers: 4,
            timeoutMs: 20000,
            earlyStopping: true,
            targetScore: 850,
          }
        );

        const timeElapsed = Date.now() - startTime;

        if (result) {
          return {
            success: result.success,
            schedule: result.schedule,
            score: result.score,
            method: result.method,
            cspIterations: result.cspIterations,
            cspBacktracks: result.cspBacktracks,
            geneticIterations: result.geneticIterations,
            timeElapsed,
          };
        }

        throw new Error('No result from solver');
      } catch (error: any) {
        console.error(`[Worker ${workerId}] Job ${job.id} failed:`, error.message);
        throw error;
      }
    },
    {
      connection,
      concurrency: 2,
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker ${workerId}] Job ${job.id} completed successfully`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker ${workerId}] Job ${job?.id} failed:`, err.message);
  });

  worker.on('error', (err) => {
    console.error(`[Worker ${workerId}] Worker error:`, err);
  });

  return worker;
};

const workers: Worker[] = [];

for (let i = 0; i < numWorkers; i++) {
  workers.push(createSolverWorker(i));
}

console.log(`Started ${workers.length} workers`);

process.on('SIGTERM', async () => {
  console.log('Shutting down workers...');
  
  await Promise.all(workers.map(w => w.close()));
  
  await connection.quit();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('Shutting down workers...');
  
  await Promise.all(workers.map(w => w.close()));
  
  await connection.quit();
  
  process.exit(0);
});

import { Worker } from 'worker_threads';
import * as path from 'path';
import * as os from 'os';
import { Lesson, SlotIndex } from '../solver/fastCSPSolver';
import { HybridConfig, PenaltyWeights, HybridResult } from '../solver/fastHybridSolver';

interface ParallelSolveOptions {
  workers?: number;
  timeoutMs?: number;
  targetScore?: number;
  earlyStopping?: boolean;
  strategy?: 'fast' | 'balanced' | 'aggressive' | 'mixed';
}

interface WorkerInput {
  lessons: Lesson[];
  slots: SlotIndex[];
  seed: number;
  config?: Partial<HybridConfig>;
  weights?: PenaltyWeights;
  strategy?: 'fast' | 'balanced' | 'aggressive';
}

interface WorkerOutput {
  success: boolean;
  result?: HybridResult;
  error?: string;
}

export function solveDistributed(
  lessons: Lesson[],
  slots: SlotIndex[],
  options: ParallelSolveOptions = {}
): Promise<HybridResult | null> {
  const numWorkers = options.workers ?? Math.max(1, os.cpus().length - 1);
  const timeoutMs = options.timeoutMs ?? 30000;
  const targetScore = options.targetScore ?? 0;
  const earlyStopping = options.earlyStopping ?? true;
  const strategy = options.strategy ?? 'mixed';

  return new Promise((resolve, reject) => {
    const workers: Worker[] = [];
    const results: HybridResult[] = [];

    let finished = 0;
    let resolved = false;
    let bestScore = -Infinity;

    const strategies: Array<'fast' | 'balanced' | 'aggressive'> = 
      strategy === 'mixed' 
        ? ['fast', 'balanced', 'aggressive'] 
        : [strategy as 'fast' | 'balanced' | 'aggressive'];

    const cleanup = () => {
      workers.forEach(w => {
        try {
          w.terminate();
        } catch (e) {
          // Worker may have already terminated
        }
      });
    };

    for (let i = 0; i < numWorkers; i++) {
      const workerStrategy = strategies[i % strategies.length];
      const workerSeed = Date.now() + i * 1000;

      const workerData: WorkerInput = {
        lessons,
        slots,
        seed: workerSeed,
        strategy: workerStrategy,
      };

      const worker = new Worker(
        path.resolve(__dirname, '../workers/solver.worker.js'),
        { workerData }
      );

      workers.push(worker);

      worker.on('message', (msg: WorkerOutput) => {
        finished++;

        if (msg.success && msg.result) {
          results.push(msg.result);

          if (msg.result.score > bestScore) {
            bestScore = msg.result.score;
          }

          if (earlyStopping && targetScore > 0 && msg.result.score >= targetScore && !resolved) {
            resolved = true;
            resolve(msg.result);
            cleanup();
            return;
          }
        }

        if (finished === numWorkers && !resolved) {
          resolved = true;

          const best = pickBest(results);
          resolve(best);

          cleanup();
        }
      });

      worker.on('error', (err) => {
        finished++;
        console.error('Worker error:', err);

        if (finished === numWorkers && !resolved) {
          resolved = true;
          const best = pickBest(results);
          resolve(best);
          cleanup();
        }
      });

      worker.on('exit', (code) => {
        if (code !== 0 && code !== 1) {
          finished++;
        }
      });
    }

    setTimeout(() => {
      if (!resolved) {
        resolved = true;

        const best = pickBest(results);
        resolve(best);

        cleanup();
      }
    }, timeoutMs);
  });
}

function pickBest(results: HybridResult[]): HybridResult | null {
  if (results.length === 0) return null;

  return results.reduce((best, current) =>
    current.score > (best?.score ?? -Infinity) ? current : best
  );
}

export async function runParallelHybrid(
  lessons: Lesson[],
  slots: SlotIndex[],
  config?: Partial<HybridConfig>,
  weights?: PenaltyWeights,
  workerCount?: number
): Promise<HybridResult> {
  const numWorkers = workerCount ?? Math.max(1, os.cpus().length - 1);

  const promises: Promise<HybridResult | null>[] = [];

  for (let i = 0; i < numWorkers; i++) {
    const strategy = i % 3 === 0 ? 'fast' : i % 3 === 1 ? 'balanced' : 'aggressive';
    
    promises.push(
      new Promise((resolve) => {
        const worker = new Worker(
          path.resolve(__dirname, '../workers/solver.worker.js'),
          {
            workerData: {
              lessons,
              slots,
              seed: Date.now() + i * 1000,
              config,
              weights,
              strategy,
            },
          }
        );

        worker.on('message', (msg: WorkerOutput) => {
          worker.terminate();
          resolve(msg.success && msg.result ? msg.result : null);
        });

        worker.on('error', () => {
          worker.terminate();
          resolve(null);
        });

        setTimeout(() => {
          worker.terminate();
          resolve(null);
        }, 30000);
      })
    );
  }

  const results = await Promise.all(promises);
  const validResults = results.filter((r): r is HybridResult => r !== null);

  if (validResults.length === 0) {
    return {
      schedule: null,
      success: false,
      score: 0,
      method: 'hybrid',
      cspIterations: 0,
      cspBacktracks: 0,
      geneticIterations: 0,
      timeElapsed: 0,
    };
  }

  return validResults.reduce((best, current) =>
    current.score > best.score ? current : best
  );
}

export function solveIncremental(
  affectedLessons: Lesson[],
  slots: SlotIndex[],
  existingSchedule: Map<string, SlotIndex>,
  options: ParallelSolveOptions = {}
): Promise<HybridResult | null> {
  const optimizedOptions = {
    ...options,
    workers: options.workers ?? 2,
    timeoutMs: options.timeoutMs ?? 5000,
    earlyStopping: true,
    targetScore: 800,
  };

  return solveDistributed(affectedLessons, slots, optimizedOptions);
}

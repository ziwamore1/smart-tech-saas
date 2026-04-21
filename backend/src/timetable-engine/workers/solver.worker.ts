import { parentPort, workerData } from 'worker_threads';
import { generateTimetableHybrid, HybridConfig, PenaltyWeights } from '../solver/fastHybridSolver';
import { Lesson } from '../solver/fastCSPSolver';
import { SlotIndex } from '../entities/cache';

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
  result?: ReturnType<typeof generateTimetableHybrid>;
  error?: string;
}

function seededRandom(seed: number): () => number {
  return function () {
    seed = (seed * 9301 + 49297) % 233280;
    return seed / 233280;
  };
}

function applyStrategyConfig(strategy: string): Partial<HybridConfig> {
  switch (strategy) {
    case 'fast':
      return {
        cspMaxIterations: 5000,
        cspMaxTime: 5000,
        populationSize: 10,
        generations: 20,
        targetScore: 800,
      };
    case 'aggressive':
      return {
        cspMaxIterations: 20000,
        cspMaxTime: 60000,
        populationSize: 40,
        generations: 100,
        targetScore: 950,
      };
    case 'balanced':
    default:
      return {
        cspMaxIterations: 10000,
        cspMaxTime: 30000,
        populationSize: 20,
        generations: 50,
        targetScore: 900,
      };
  }
}

function run() {
  const { lessons, slots, seed, config, weights, strategy = 'balanced' } = workerData as WorkerInput;

  (Math as any).random = seededRandom(seed);

  try {
    const strategyConfig = applyStrategyConfig(strategy);
    const mergedConfig = { ...strategyConfig, ...config };

    const result = generateTimetableHybrid(lessons, slots, mergedConfig, weights);

    const output: WorkerOutput = {
      success: true,
      result,
    };

    parentPort?.postMessage(output);
  } catch (err: any) {
    const output: WorkerOutput = {
      success: false,
      error: err.message,
    };

    parentPort?.postMessage(output);
  }
}

run();

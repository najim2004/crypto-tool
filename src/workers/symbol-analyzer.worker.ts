/**
 * Symbol Analyzer Worker
 * Runs in separate thread to analyze assigned symbols in parallel
 */

import { parentPort, workerData } from 'worker_threads';
import { strategyService } from '../modules/strategy/strategy.service.js';
import { connectDB } from '../utils/db-connection.js';
import {
  NewSignalMessage,
  WorkerReadyMessage,
  WorkerErrorMessage,
  HeartbeatMessage,
} from './worker-messages.interface.js';
import logger from '../utils/logger.js';

const { symbols, workerId } = workerData as { symbols: string[]; workerId: number };

// Initialize worker
async function initializeWorker(): Promise<void> {
  try {
    // Connect to database
    await connectDB();

    logger.info(`✅ Symbol Worker ${workerId} initialized for: ${symbols.join(', ')}`);

    // Notify main process that worker is ready
    const readyMessage: WorkerReadyMessage = {
      type: 'WORKER_READY',
      workerId,
      data: {
        symbols,
        workerType: 'SYMBOL',
      },
      timestamp: Date.now(),
    };

    parentPort?.postMessage(readyMessage);

    // Start polling
    startPolling();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ Symbol Worker ${workerId} initialization failed: ${msg}`);

    const errorMessage: WorkerErrorMessage = {
      type: 'ERROR',
      workerId,
      data: {
        error: msg,
        stack: error instanceof Error ? error.stack : undefined,
      },
      timestamp: Date.now(),
    };

    parentPort?.postMessage(errorMessage);
    process.exit(1);
  }
}

/**
 * Analyze assigned symbols
 */
async function analyzeSymbols(): Promise<void> {
  try {
    for (const symbol of symbols) {
      try {
        const signal = await strategyService.evaluateSymbol(symbol);

        if (signal) {
          logger.info(`🎯 Worker ${workerId} detected signal for ${symbol}`);

          // Send signal to main process
          const message: NewSignalMessage = {
            type: 'NEW_SIGNAL',
            workerId,
            data: signal,
            timestamp: Date.now(),
          };

          parentPort?.postMessage(message);
        }
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        logger.error(`❌ Worker ${workerId} error analyzing ${symbol}: ${msg}`);
      }
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ Worker ${workerId} polling error: ${msg}`);

    const errorMessage: WorkerErrorMessage = {
      type: 'ERROR',
      workerId,
      data: {
        error: msg,
        stack: error instanceof Error ? error.stack : undefined,
      },
      timestamp: Date.now(),
    };

    parentPort?.postMessage(errorMessage);
  } finally {
    // Send heartbeat
    const heartbeat: HeartbeatMessage = {
      type: 'HEARTBEAT',
      workerId,
      data: {
        workerId,
        status: 'ALIVE',
      },
      timestamp: Date.now(),
    };
    parentPort?.postMessage(heartbeat);
  }
}

/**
 * Start polling loop
 */
function startPolling(): void {
  // Poll every 10 seconds
  setInterval(() => {
    analyzeSymbols().catch((err: Error) => {
      logger.error(`Worker ${workerId} polling loop error: ${err.message}`);
    });
  }, 10000);

  // Run immediately
  analyzeSymbols().catch((err: Error) => {
    logger.error(`Worker ${workerId} initial analysis error: ${err.message}`);
  });
}

// Handle shutdown signals
process.on('SIGTERM', () => {
  logger.info(`Worker ${workerId} received SIGTERM, shutting down...`);
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info(`Worker ${workerId} received SIGINT, shutting down...`);
  process.exit(0);
});

// Start worker
initializeWorker().catch(error => {
  logger.error(`Fatal error in worker ${workerId}: ${error}`);
  process.exit(1);
});

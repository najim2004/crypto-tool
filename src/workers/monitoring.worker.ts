/**
 * Monitoring Worker
 * Dedicated worker for tracking open signals and risk analysis
 */

import { parentPort, workerData } from 'worker_threads';
import { SignalModel } from '../modules/signal/signal.model.js';
import { signalMonitorService } from '../modules/signal/signal-monitor.service.js';
import { riskMonitorService } from '../modules/signal/risk-monitor.service.js';
import { connectDB } from '../utils/db-connection.js';
import {
  MonitoringStatusMessage,
  WorkerReadyMessage,
  WorkerErrorMessage,
} from './worker-messages.interface.js';
import logger from '../utils/logger.js';
import { Signal } from '../interface/trading.interface.js';

const { workerId } = workerData as { workerId: number };

// Initialize worker
async function initializeWorker(): Promise<void> {
  try {
    // Connect to database
    await connectDB();

    logger.info('✅ Monitoring Worker initialized');

    // Notify main process
    const readyMessage: WorkerReadyMessage = {
      type: 'WORKER_READY',
      workerId,
      data: {
        workerType: 'MONITORING',
      },
      timestamp: Date.now(),
    };

    parentPort?.postMessage(readyMessage);

    // Start monitoring
    startMonitoring();
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ Monitoring Worker initialization failed: ${msg}`);

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
 * Monitor open signals
 */
async function monitorPositions(): Promise<void> {
  try {
    // 1. Check TP/SL hits
    // Returns array of status updates - send to main process for telegram notifications
    const statusUpdates = await signalMonitorService.monitorOpenSignals();

    // Send status updates to main process
    for (const update of statusUpdates) {
      parentPort?.postMessage({
        type: 'STATUS_UPDATE',
        workerId,
        data: update,
        timestamp: Date.now(),
      });
    }

    // 2. Risk analysis
    const openSignals = await SignalModel.find({ status: 'OPEN' });

    for (const dbSignal of openSignals) {
      const signal = dbSignal.toObject() as unknown as Signal;
      // Risk monitor handles warnings internally via telegram
      // We keep this for early exit detection
      await riskMonitorService.analyzeRisk(signal);
    }

    // 3. Send status update to main process
    const statusMessage: MonitoringStatusMessage = {
      type: 'MONITORING_STATUS',
      workerId,
      data: {
        openSignalsCount: openSignals.length,
        lastCheck: new Date(),
      },
      timestamp: Date.now(),
    };

    parentPort?.postMessage(statusMessage);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ Monitoring Worker error: ${msg}`);

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
  }
}

/**
 * Start monitoring loop
 */
function startMonitoring(): void {
  // Monitor every 10 seconds
  setInterval(() => {
    monitorPositions().catch((err: Error) => {
      logger.error(`Monitoring Worker polling error: ${err.message}`);
    });
  }, 10000);

  // Run immediately
  monitorPositions().catch((err: Error) => {
    logger.error(`Monitoring Worker initial run error: ${err.message}`);
  });
}

// Handle shutdown signals
process.on('SIGTERM', () => {
  logger.info('Monitoring Worker received SIGTERM, shutting down...');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('Monitoring Worker received SIGINT, shutting down...');
  process.exit(0);
});

// Start worker
initializeWorker().catch(error => {
  logger.error(`Fatal error in Monitoring Worker: ${error}`);
  process.exit(1);
});

import { Worker } from 'worker_threads';
import { EventEmitter } from 'events';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  WorkerMessage,
  NewSignalMessage,
  RiskWarningMessage,
  MonitoringStatusMessage,
  TelegramForwardMessage,
  HeartbeatMessage,
} from './worker-messages.interface.js';
import logger from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface WorkerInfo {
  worker: Worker;
  id: number;
  type: 'SYMBOL' | 'MONITORING';
  symbols?: string[];
  restartCount: number;
  lastHealthCheck: Date;
}

/**
 * Worker Pool Manager
 * Manages lifecycle of all worker threads
 */
export class WorkerPoolManager extends EventEmitter {
  private workers: Map<number, WorkerInfo> = new Map();
  private isShuttingDown = false;
  private healthCheckInterval?: NodeJS.Timeout;

  // Symbol groups for parallel analysis
  private readonly symbolGroups: string[][] = [
    ['BTCUSDT', 'ETHUSDT', 'SOLUSDT', 'BNBUSDT', 'XRPUSDT'],
    ['DOGEUSDT', 'ADAUSDT', 'AVAXUSDT', 'TRXUSDT', 'LINKUSDT'],
    ['DOTUSDT', 'MATICUSDT', 'LTCUSDT', 'SHIBUSDT', 'PEPEUSDT'],
    ['SUIUSDT', 'ARBUSDT', 'OPUSDT', 'APTUSDT', 'INJUSDT'],
  ];

  private readonly config = {
    maxRestarts: 3,
    healthCheckInterval: 30000, // 30 seconds
    restartDelay: 2000, // 2 seconds
  };

  /**
   * Initialize all workers
   */
  async initialize(): Promise<void> {
    logger.info('🚀 Initializing Worker Pool...');

    // Create symbol workers (staggered start to avoid rate limits)
    for (let i = 0; i < this.symbolGroups.length; i++) {
      await this.createSymbolWorker(i, this.symbolGroups[i]);
      // Stagger by 2 seconds
      if (i < this.symbolGroups.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Create monitoring worker
    await this.createMonitoringWorker();

    // Start health checks
    this.startHealthChecks();

    logger.info(`✅ Worker Pool initialized with ${this.workers.size} workers`);
  }

  /**
   * Create a symbol analyzer worker
   */
  private async createSymbolWorker(workerId: number, symbols: string[]): Promise<void> {
    const workerPath = path.join(__dirname, '../../dist/workers/symbol-analyzer.worker.js');

    const worker = new Worker(workerPath, {
      workerData: {
        symbols,
        workerId,
      },
    });

    this.setupWorkerHandlers(worker, workerId, 'SYMBOL', symbols);

    this.workers.set(workerId, {
      worker,
      id: workerId,
      type: 'SYMBOL',
      symbols,
      restartCount: 0,
      lastHealthCheck: new Date(),
    });

    logger.info(`✅ Symbol Worker ${workerId} created for: ${symbols.join(', ')}`);
  }

  /**
   * Create monitoring worker
   */
  private async createMonitoringWorker(): Promise<void> {
    const workerId = 999; // Special ID for monitoring worker
    const workerPath = path.join(__dirname, '../../dist/workers/monitoring.worker.js');

    const worker = new Worker(workerPath, {
      workerData: {
        workerId,
      },
    });

    this.setupWorkerHandlers(worker, workerId, 'MONITORING');

    this.workers.set(workerId, {
      worker,
      id: workerId,
      type: 'MONITORING',
      restartCount: 0,
      lastHealthCheck: new Date(),
    });

    logger.info('✅ Monitoring Worker created');
  }

  /**
   * Setup worker event handlers
   */
  private setupWorkerHandlers(
    worker: Worker,
    workerId: number,
    type: 'SYMBOL' | 'MONITORING',
    symbols?: string[]
  ): void {
    // Handle messages from worker
    worker.on('message', (message: WorkerMessage) => {
      this.handleWorkerMessage(workerId, message);
    });

    // Handle worker errors
    worker.on('error', (error: Error) => {
      logger.error(`❌ Worker ${workerId} error: ${error.message}`);
      this.emit('workerError', { workerId, error });
    });

    // Handle worker exit
    worker.on('exit', (code: number) => {
      if (code !== 0 && !this.isShuttingDown) {
        logger.warn(`⚠️ Worker ${workerId} exited with code ${code}`);
        this.handleWorkerCrash(workerId, type, symbols);
      }
    });
  }

  /**
   * Handle messages from workers
   */
  private handleWorkerMessage(workerId: number, message: WorkerMessage): void {
    // Update last health check
    const workerInfo = this.workers.get(workerId);
    if (workerInfo) {
      workerInfo.lastHealthCheck = new Date();
    }

    switch (message.type) {
      case 'NEW_SIGNAL':
        this.emit('signal', (message as NewSignalMessage).data);
        break;

      case 'RISK_WARNING':
        this.emit('warning', (message as RiskWarningMessage).data);
        break;

      case 'MONITORING_STATUS':
        this.emit('status', (message as MonitoringStatusMessage).data);
        break;

      case 'TELEGRAM_FORWARD':
        this.emit('telegramRequest', (message as TelegramForwardMessage).data);
        break;

      case 'HEARTBEAT':
        // Health check updated automatically by handleWorkerMessage entry
        break;

      case 'WORKER_READY':
        logger.info(`✅ Worker ${workerId} ready`);
        break;

      case 'ERROR':
        logger.error(`❌ Worker ${workerId} reported error: ${message.data.error}`);
        break;

      default:
        // Check for STATUS_UPDATE (custom message type)
        if ((message as any).type === 'STATUS_UPDATE') {
          this.emit('statusUpdate', (message as any).data);
        } else {
          logger.warn(`⚠️ Unknown message type from worker ${workerId}: ${message.type}`);
        }
    }
  }

  /**
   * Handle worker crash
   */
  private async handleWorkerCrash(
    workerId: number,
    type: 'SYMBOL' | 'MONITORING',
    symbols?: string[]
  ): Promise<void> {
    const workerInfo = this.workers.get(workerId);

    if (!workerInfo) {
      logger.error(`❌ Cannot restart worker ${workerId}: not found`);
      return;
    }

    if (workerInfo.restartCount >= this.config.maxRestarts) {
      logger.error(
        `❌ Worker ${workerId} exceeded max restarts (${this.config.maxRestarts}). Not restarting.`
      );
      this.workers.delete(workerId);
      return;
    }

    logger.info(`🔄 Restarting worker ${workerId} (attempt ${workerInfo.restartCount + 1})...`);

    // Wait before restart
    await new Promise(resolve => setTimeout(resolve, this.config.restartDelay));

    // Remove old worker
    this.workers.delete(workerId);

    // Create new worker
    try {
      if (type === 'SYMBOL' && symbols) {
        await this.createSymbolWorker(workerId, symbols);
      } else if (type === 'MONITORING') {
        await this.createMonitoringWorker();
      }

      // Increment restart count
      const newWorkerInfo = this.workers.get(workerId);
      if (newWorkerInfo) {
        newWorkerInfo.restartCount = workerInfo.restartCount + 1;
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to restart worker ${workerId}: ${msg}`);
    }
  }

  /**
   * Start health checks
   */
  private startHealthChecks(): void {
    this.healthCheckInterval = setInterval(() => {
      const now = Date.now();

      for (const [workerId, workerInfo] of this.workers.entries()) {
        const timeSinceLastCheck = now - workerInfo.lastHealthCheck.getTime();

        if (timeSinceLastCheck > this.config.healthCheckInterval * 2) {
          logger.warn(
            `⚠️ Worker ${workerId} hasn't responded in ${Math.round(timeSinceLastCheck / 1000)}s`
          );
        }
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Shutdown all workers gracefully
   */
  async shutdown(): Promise<void> {
    this.isShuttingDown = true;
    logger.info('🛑 Shutting down Worker Pool...');

    // Stop health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    // Terminate all workers
    const terminationPromises: Promise<number>[] = [];

    for (const [workerId, workerInfo] of this.workers.entries()) {
      logger.info(`Terminating worker ${workerId}...`);
      terminationPromises.push(workerInfo.worker.terminate());
    }

    await Promise.all(terminationPromises);

    this.workers.clear();
    logger.info('✅ All workers terminated');
  }

  /**
   * Get worker pool status
   */
  getStatus(): {
    totalWorkers: number;
    symbolWorkers: number;
    monitoringWorkers: number;
    workers: Array<{ id: number; type: string; symbols?: string[]; restarts: number }>;
  } {
    const workers = Array.from(this.workers.values()).map(w => ({
      id: w.id,
      type: w.type,
      symbols: w.symbols,
      restarts: w.restartCount,
    }));

    return {
      totalWorkers: this.workers.size,
      symbolWorkers: workers.filter(w => w.type === 'SYMBOL').length,
      monitoringWorkers: workers.filter(w => w.type === 'MONITORING').length,
      workers,
    };
  }
}

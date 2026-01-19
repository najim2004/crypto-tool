import { aiService } from '../modules/ai/ai.service.js';
import { telegramService } from '../modules/telegram/telegram.service.js';
import { SignalModel } from '../modules/signal/signal.model.js';
import { WorkerPoolManager } from '../workers/worker-pool.manager.js';
import { connectDB } from '../utils/db-connection.js';
import { pnlService } from '../modules/math/index.js';
import logger from '../utils/logger.js';
import { Signal } from '../interface/trading.interface.js';

export class CoreLoader {
  private static workerPool: WorkerPoolManager;
  private static signalCooldowns = new Map<string, number>();
  private static readonly COOLDOWN_DURATION = 4 * 60 * 60 * 1000; // 4 hours

  static async init(): Promise<void> {
    logger.info('🚀 Initializing Multi-Worker Trading System...');

    try {
      // Connect to database in main process
      await connectDB();

      // Initialize worker pool
      this.workerPool = new WorkerPoolManager();

      // Setup event handlers for worker messages
      this.workerPool.on('signal', this.handleNewSignal.bind(this));
      this.workerPool.on('warning', this.handleRiskWarning.bind(this));
      this.workerPool.on('status', this.handleMonitoringStatus.bind(this));
      this.workerPool.on('statusUpdate', this.handleStatusUpdate.bind(this));
      this.workerPool.on('telegramRequest', this.handleTelegramRequest.bind(this));
      this.workerPool.on('workerError', this.handleWorkerError.bind(this));

      // Start workers
      await this.workerPool.initialize();

      // Setup graceful shutdown
      this.setupShutdownHandlers();

      // Send daily EOD summary (keep in main process)
      setInterval(() => {
        const now = new Date();
        if (now.getUTCHours() === 23 && now.getUTCMinutes() === 59) {
          this.sendEODSummary().catch((err: Error) =>
            logger.error(`EOD Summary Error: ${err.message}`)
          );
        }
      }, 60000);

      logger.info('✅ Multi-Worker Trading System initialized');
      this.logSystemStatus();
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Failed to initialize trading system: ${msg}`);
      throw error;
    }
  }

  /**
   * Handle new signal from worker
   */
  private static async handleNewSignal(signal: Signal): Promise<void> {
    try {
      // Check cooldown
      const now = Date.now();
      const lastSignal = await SignalModel.findOne({ symbol: signal.symbol }).sort({
        timestamp: -1,
      });
      const dbLastTime = lastSignal ? new Date(lastSignal.timestamp).getTime() : 0;
      const lastSignalTime = Math.max(this.signalCooldowns.get(signal.symbol) || 0, dbLastTime);
      const timeSinceLastSignal = now - lastSignalTime;
      const cooldownRemaining = this.COOLDOWN_DURATION - timeSinceLastSignal;

      if (cooldownRemaining > 0) {
        const minutesRemaining = Math.ceil(cooldownRemaining / 60000);
        logger.info(
          `⏭️ [${signal.symbol}] Skipped - cooldown active (${minutesRemaining} min remaining)`
        );
        return;
      }

      logger.info(`🎯 Signal received for ${signal.symbol}! Evaluating with AI...`);

      // AI Scoring
      const context = signal.technicalContext
        ? `Trend: ${signal.technicalContext.trend}, ADX: ${signal.technicalContext.adx.toFixed(1)}, Volume: ${signal.technicalContext.volumeRatio}x SMA, RSI(1H/15m/5m): ${signal.technicalContext.rsi['1h'].toFixed(1)} / ${signal.technicalContext.rsi['15m'].toFixed(1)} / ${signal.technicalContext.rsi['5m'].toFixed(1)}`
        : 'Technical confluence confirmed.';

      const aiResult = await aiService.scoreSignal(signal, context);

      if (aiResult.score >= 70) {
        signal.aiScore = aiResult.score;
        signal.aiReason = aiResult.reason;

        // Save to DB
        await SignalModel.create({
          symbol: signal.symbol,
          direction: signal.direction,
          entryPrice: signal.entryPrice,
          entryRange: signal.entryRange,
          stopLoss: signal.stopLoss,
          takeProfit: signal.takeProfit,
          takeProfits: signal.takeProfits,
          timestamp: signal.timestamp,
          aiScore: aiResult.score,
          aiReason: aiResult.reason,
          status: 'OPEN',
          quality: signal.quality,
          technicalContext: signal.technicalContext,
        });

        // Send Notification
        await telegramService.sendSignal(signal);

        // Record cooldown
        this.signalCooldowns.set(signal.symbol, Date.now());

        logger.info(
          `✅ [${signal.symbol}] Signal sent (Score: ${aiResult.score}/100). Next signal in 4 hours.`
        );
      } else {
        logger.info(`⚠️ [${signal.symbol}] Signal discarded by AI (Score: ${aiResult.score})`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error handling signal for ${signal.symbol}: ${msg}`);
    }
  }

  /**
   * Handle risk warning from monitoring worker
   */
  private static async handleRiskWarning(warning: any): Promise<void> {
    logger.warn(`⚠️ Risk warning received: ${JSON.stringify(warning)}`);
    // Risk monitor already sends telegram notifications
  }

  /**
   * Handle signal status update from monitoring worker
   */
  private static async handleStatusUpdate(update: {
    signal: Signal;
    status: Signal['status'];
    exitPrice: number;
    pnlPercent: number;
    pnlAmount: number;
  }): Promise<void> {
    try {
      const { signal, status, exitPrice, pnlPercent, pnlAmount } = update;
      const emoji = pnlPercent > 0 ? '🎉' : '📉';
      const statusText = this.getStatusText(status);

      const message = `
${emoji} *Signal Status Update*
━━━━━━━━━━━━━━━━━━
📊 *${signal.symbol}* ${signal.direction}
📍 *Status:* ${statusText}

💰 *Entry:* ${signal.entryPrice.toFixed(4)}
💰 *Exit:* ${exitPrice.toFixed(4)}

📈 *P/L:* ${pnlService.formatPnLPercentage(pnlPercent)}
💵 *Amount:* ${pnlService.formatPnL(pnlAmount, true, 4)}

⏰ *Closed at:* ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
━━━━━━━━━━━━━━━━━━
      `.trim();

      await telegramService.sendStatusUpdate(message);
      logger.info(`✅ Status notification sent for ${signal.symbol}: ${status}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error sending status update: ${msg}`);
    }
  }

  /**
   * Get human-readable status text
   */
  private static getStatusText(status: Signal['status']): string {
    const statusMap: Record<Signal['status'], string> = {
      OPEN: 'Open Position',
      HIT_TP1: '✅ Target 1 Hit',
      HIT_TP2: '✅ Target 2 Hit (Final)',
      HIT_SL: '❌ Stop Loss Hit',
      EARLY_EXIT: '⚠️ Early Exit',
      CLOSED_EOD: '🌙 Closed End of Day',
    };

    return statusMap[status] || status;
  }

  /**
   * Handle monitoring status update
   */
  private static handleMonitoringStatus(status: {
    openSignalsCount: number;
    lastCheck: Date;
  }): void {
    if (status.openSignalsCount > 0) {
      logger.info(`📊 Monitoring ${status.openSignalsCount} open signal(s)`);
    }
  }

  /**
   * Handle forwarded telegram request from worker
   */
  private static async handleTelegramRequest(request: {
    method: string;
    args: any[];
  }): Promise<void> {
    try {
      const { method, args } = request;
      if (typeof (telegramService as any)[method] === 'function') {
        await (telegramService as any)[method](...args);
      } else {
        logger.warn(`⚠️ Unknown telegram method requested: ${method}`);
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error handling telegram request: ${msg}`);
    }
  }

  /**
   * Handle worker error
   */
  private static handleWorkerError(error: { workerId: number; error: Error }): void {
    logger.error(`❌ Worker ${error.workerId} error: ${error.error.message}`);
  }

  /**
   * Send end-of-day summary
   */
  private static async sendEODSummary(): Promise<void> {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);

    const signals = await SignalModel.find({
      timestamp: { $gte: today },
    });

    if (signals.length === 0) {
      await telegramService.sendSignal({
        symbol: 'DAILY_SUMMARY',
        direction: 'LONG',
        entryPrice: 0,
        stopLoss: 0,
        takeProfit: 0,
        timestamp: new Date(),
        status: 'CLOSED_EOD',
        aiReason: 'No signals generated today.',
      });
      return;
    }

    const summary = `📅 *EOD Summary:* ${signals.length} signals generated today.`;
    await telegramService.sendSignal({
      symbol: 'DAILY_SUMMARY',
      direction: 'LONG',
      entryPrice: 0,
      stopLoss: 0,
      takeProfit: 0,
      timestamp: new Date(),
      status: 'CLOSED_EOD',
      aiScore: signals.length,
      aiReason: summary,
    });
  }

  /**
   * Setup graceful shutdown handlers
   */
  private static setupShutdownHandlers(): void {
    const shutdown = async () => {
      logger.info('🛑 Shutting down gracefully...');

      if (this.workerPool) {
        await this.workerPool.shutdown();
      }

      logger.info('✅ Shutdown complete');
      process.exit(0);
    };

    process.on('SIGTERM', shutdown);
    process.on('SIGINT', shutdown);
  }

  /**
   * Log system status
   */
  private static logSystemStatus(): void {
    const status = this.workerPool.getStatus();
    logger.info('📊 Worker Pool Status:');
    logger.info(`   Total Workers: ${status.totalWorkers}`);
    logger.info(`   Symbol Workers: ${status.symbolWorkers}`);
    logger.info(`   Monitoring Workers: ${status.monitoringWorkers}`);

    status.workers.forEach(w => {
      if (w.type === 'SYMBOL') {
        logger.info(`   Worker ${w.id}: ${w.symbols?.join(', ')}`);
      } else {
        logger.info(`   Worker ${w.id}: Monitoring`);
      }
    });
  }
}

import { strategyService } from '../modules/strategy/strategy.service.js';
import { aiService } from '../modules/ai/ai.service.js';
import { telegramService } from '../modules/telegram/telegram.service.js';
import { SignalModel } from '../modules/signal/signal.model.js';
import logger from '../utils/logger.js';

export class CoreLoader {
  private static isPolling = false;
  private static signalCooldowns = new Map<string, number>();
  private static readonly COOLDOWN_DURATION = 4 * 60 * 60 * 1000; // 4 hours - prevents overtrading

  static init(): void {
    logger.info('🚀 Initializing Trading Core...');
    // Poll every 1 minute
    setInterval(() => {
      this.poll().catch((err: Error) => logger.error(`Polling Error: ${err.message}`));
    }, 10000);

    this.poll().catch((err: Error) => logger.error(`Initial Polling Error: ${err.message}`));

    // End of day summary logic (example: run at 11:59 PM UTC)
    setInterval(() => {
      const now = new Date();
      if (now.getUTCHours() === 23 && now.getUTCMinutes() === 59) {
        this.sendEODSummary().catch((err: Error) =>
          logger.error(`EOD Summary Error: ${err.message}`)
        );
      }
    }, 60000);
  }

  private static async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      logger.info('🔍 Evaluating market conditions...');
      const signals = await strategyService.evaluateAll();

      for (const signal of signals) {
        if (signal) {
          // Check cooldown - skip if signal was sent recently for this symbol
          const now = Date.now();

          // Check DB for last signal time to persist cooldown across restarts
          const lastSignal = await SignalModel.findOne({ symbol: signal.symbol }).sort({
            timestamp: -1,
          });
          const dbLastTime = lastSignal ? new Date(lastSignal.timestamp).getTime() : 0;

          // Use the more recent of memory cache or DB
          const lastSignalTime = Math.max(this.signalCooldowns.get(signal.symbol) || 0, dbLastTime);

          const timeSinceLastSignal = now - lastSignalTime;
          const cooldownRemaining = this.COOLDOWN_DURATION - timeSinceLastSignal;

          if (cooldownRemaining > 0) {
            const minutesRemaining = Math.ceil(cooldownRemaining / 60000);
            logger.info(
              `⏭️ [${signal.symbol}] Skipped - cooldown active (${minutesRemaining} min remaining)`
            );
            continue; // Skip this signal
          }

          logger.info(`🎯 Signal detected for ${signal.symbol}! Using technical analysis...`);

          // AI Scoring Enabled
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
              stopLoss: signal.stopLoss,
              takeProfit: signal.takeProfit,
              timestamp: signal.timestamp,
              aiScore: aiResult.score,
              aiReason: aiResult.reason,
              status: 'OPEN',
              technicalContext: signal.technicalContext,
            });

            // Send Notification
            await telegramService.sendSignal(signal);

            // Record signal time for cooldown
            this.signalCooldowns.set(signal.symbol, Date.now());

            logger.info(
              `✅ [${signal.symbol}] Signal sent (Score: ${aiResult.score}/100). Next signal in 4 hours.`
            );
          } else {
            logger.info(`⚠️ [${signal.symbol}] Signal discarded by AI (Score: ${aiResult.score})`);
          }
        }
      }

      if (signals.length === 0) {
        logger.info('😴 No valid signals found in this cycle.');
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error in polling loop: ${msg}`);
    } finally {
      this.isPolling = false;
    }
  }

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
    // In a real scenario, you'd calculate win/loss here
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
}

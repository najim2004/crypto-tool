import { strategyService } from '../modules/strategy/strategy.service.js';
import { aiService } from '../modules/ai/ai.service.js';
import { telegramService } from '../modules/telegram/telegram.service.js';
import { SignalModel } from '../modules/signal/signal.model.js';
import logger from '../utils/logger.js';

export class CoreLoader {
  private static isPolling = false;

  static init(): void {
    logger.info('🚀 Initializing Trading Core...');
    // Poll every 1 minute
    setInterval(() => {
      this.poll().catch((err: Error) => logger.error(`Polling Error: ${err.message}`));
    }, 60000);

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
      const signal = await strategyService.evaluate();

      if (signal) {
        logger.info('🎯 Signal detected! Requesting AI evaluation...');
        const aiResult = await aiService.scoreSignal(
          signal,
          'Technical confluence on 1H/15m/5m timeframes.'
        );

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
          });

          // Send Notification
          await telegramService.sendSignal(signal);
          logger.info('✅ Signal sent to Telegram and saved to database.');
        } else {
          logger.info(`⚠️ Signal discarded by AI (Score: ${aiResult.score})`);
        }
      } else {
        logger.info('😴 No valid signal found in this cycle.');
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

import { binanceService } from '../binance/binance.service.js';
import { telegramService } from '../telegram/telegram.service.js';
import { riskRewardService, pnlService, percentageService } from '../math/index.js';
import { Signal } from '../../interface/trading.interface.js';
import logger from '../../utils/logger.js';

/**
 * Risk Monitor Service
 * Monitors risk levels and sends early exit warnings
 */
export class RiskMonitorService {
  // Configurable thresholds
  private readonly EARLY_EXIT_THRESHOLD = 0.5; // 50% to SL
  private readonly MAX_LOSS_PERCENT = 1.5; // 1.5% max loss warning
  private readonly WARNING_COOLDOWN = 15 * 60 * 1000; // 15 minutes

  // Track warnings to avoid spam
  private warningsSent = new Map<string, number>();

  /**
   * Analyze risk for an open signal
   */
  async analyzeRisk(signal: Signal): Promise<void> {
    try {
      // Fetch current price
      const klines = await binanceService.fetchKlines(signal.symbol, '1m', 1);
      if (klines.length === 0) {
        return;
      }

      const currentPrice = klines[0].close;

      // Calculate current position in risk zone
      const riskPosition = riskRewardService.calculateRiskPosition(
        currentPrice,
        signal.entryPrice,
        signal.stopLoss,
        signal.direction
      );

      // Calculate unrealized P/L
      const unrealizedPnL = pnlService.calculateUnrealizedPnL(
        signal.entryPrice,
        currentPrice,
        signal.direction
      );

      // Check if approaching stop loss
      const isApproachingSL = riskRewardService.isApproachingSL(
        currentPrice,
        signal.entryPrice,
        signal.stopLoss,
        signal.direction,
        this.EARLY_EXIT_THRESHOLD
      );

      // Check if max loss threshold exceeded
      const isExcessiveLoss = unrealizedPnL < -this.MAX_LOSS_PERCENT;

      // Should we warn?
      if (isApproachingSL || isExcessiveLoss) {
        const shouldWarn = this.shouldWarnEarlyExit(signal.symbol);

        if (shouldWarn) {
          await this.sendEarlyExitWarning(signal, currentPrice, riskPosition, unrealizedPnL);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error analyzing risk for ${signal.symbol}: ${msg}`);
    }
  }

  /**
   * Check if we should send a warning (cooldown logic)
   */
  private shouldWarnEarlyExit(symbol: string): boolean {
    const lastWarning = this.warningsSent.get(symbol);
    const now = Date.now();

    if (!lastWarning) {
      this.warningsSent.set(symbol, now);
      return true;
    }

    const timeSinceLastWarning = now - lastWarning;

    if (timeSinceLastWarning >= this.WARNING_COOLDOWN) {
      this.warningsSent.set(symbol, now);
      return true;
    }

    return false; // Still in cooldown
  }

  /**
   * Send early exit warning notification
   */
  private async sendEarlyExitWarning(
    signal: Signal,
    currentPrice: number,
    riskPosition: number,
    unrealizedPnL: number
  ): Promise<void> {
    const riskPercentage = Math.round(riskPosition * 100);
    const distanceToSL = percentageService.formatPercentage(
      Math.abs(((currentPrice - signal.stopLoss) / signal.stopLoss) * 100),
      2
    );

    const message = `
⚠️ *EARLY EXIT WARNING*
━━━━━━━━━━━━━━━━━━
🚨 *${signal.symbol}* ${signal.direction}

📍 *Current Price:* ${currentPrice.toFixed(4)}
📥 *Entry Price:* ${signal.entryPrice.toFixed(4)}
🛑 *Stop Loss:* ${signal.stopLoss.toFixed(4)}

⚠️ *Risk Position:* ${riskPercentage}% to SL
📉 *Unrealized P/L:* ${pnlService.formatPnLPercentage(unrealizedPnL)}
📏 *Distance to SL:* ${distanceToSL}

💡 *Recommendation:*
${this.generateWarningMessage(unrealizedPnL, riskPosition)}

⏰ *Time:* ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
━━━━━━━━━━━━━━━━━━
_Consider closing this position to protect capital_
    `.trim();

    logger.warn(
      `⚠️ Early exit warning for ${signal.symbol}: ${riskPercentage}% to SL, P/L: ${pnlService.formatPnLPercentage(unrealizedPnL)}`
    );

    await telegramService.sendEarlyExitWarning(message);
  }

  /**
   * Generate contextual warning message
   */
  private generateWarningMessage(unrealizedPnL: number, riskPosition: number): string {
    if (unrealizedPnL < -this.MAX_LOSS_PERCENT) {
      return `Market is moving significantly against your position. Consider exiting now to minimize loss.`;
    }

    if (riskPosition >= 0.8) {
      return `Price is very close to stop loss (${Math.round(riskPosition * 100)}%). Consider manual exit.`;
    }

    if (riskPosition >= this.EARLY_EXIT_THRESHOLD) {
      return `Price has moved ${Math.round(riskPosition * 100)}% towards stop loss. Monitor closely or exit early.`;
    }

    return `Keep monitoring this position. Market conditions may have changed.`;
  }

  /**
   * Clear warning for a symbol (e.g., when signal is closed)
   */
  clearWarning(symbol: string): void {
    this.warningsSent.delete(symbol);
  }
}

export const riskMonitorService = new RiskMonitorService();

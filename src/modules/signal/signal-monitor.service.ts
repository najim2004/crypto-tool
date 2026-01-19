import { SignalModel } from './signal.model.js';
import { binanceService } from '../binance/binance.service.js';
import { riskRewardService, pnlService } from '../math/index.js';
import { Signal } from '../../interface/trading.interface.js';
import logger from '../../utils/logger.js';

/**
 * Signal Monitor Service
 * Monitors open signals and updates their status based on current market prices
 * NOTE: Does NOT send notifications directly - returns data for main process to handle
 */
export class SignalMonitorService {
  /**
   * Monitor all open signals and update their status
   * Returns array of status updates that need notifications
   */
  async monitorOpenSignals(): Promise<
    Array<{
      signal: Signal;
      status: Signal['status'];
      exitPrice: number;
      pnlPercent: number;
      pnlAmount: number;
    }>
  > {
    const statusUpdates: Array<{
      signal: Signal;
      status: Signal['status'];
      exitPrice: number;
      pnlPercent: number;
      pnlAmount: number;
    }> = [];

    try {
      const openSignals = await SignalModel.find({ status: 'OPEN' });

      if (openSignals.length === 0) {
        return statusUpdates;
      }

      logger.info(`📊 Monitoring ${openSignals.length} open signal(s)...`);

      for (const signal of openSignals) {
        const update = await this.checkSignalStatus(signal as unknown as Signal);
        if (update) {
          statusUpdates.push(update);
        }
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error monitoring signals: ${msg}`);
    }

    return statusUpdates;
  }

  /**
   * Check and update status of a single signal
   * Returns update info if status changed, null otherwise
   */
  private async checkSignalStatus(signal: Signal): Promise<{
    signal: Signal;
    status: Signal['status'];
    exitPrice: number;
    pnlPercent: number;
    pnlAmount: number;
  } | null> {
    try {
      // Fetch current price
      const klines = await binanceService.fetchKlines(signal.symbol, '1m', 1);
      if (klines.length === 0) {
        logger.warn(`⚠️ Could not fetch price for ${signal.symbol}`);
        return null;
      }

      const currentPrice = klines[0].close;

      // Check TP1 hit
      if (signal.takeProfits?.tp1) {
        const hitTP1 = riskRewardService.hasHitTP(
          currentPrice,
          signal.takeProfits.tp1,
          signal.direction
        );

        if (hitTP1) {
          return await this.updateSignalStatus(
            signal,
            'HIT_TP1',
            currentPrice,
            'TP1 reached successfully'
          );
        }
      }

      // Check TP2 hit
      if (signal.takeProfits?.tp2) {
        const hitTP2 = riskRewardService.hasHitTP(
          currentPrice,
          signal.takeProfits.tp2,
          signal.direction
        );

        if (hitTP2) {
          return await this.updateSignalStatus(
            signal,
            'HIT_TP2',
            currentPrice,
            'TP2 (final target) reached successfully'
          );
        }
      }

      // Check SL hit
      const hitSL = riskRewardService.hasHitSL(currentPrice, signal.stopLoss, signal.direction);

      if (hitSL) {
        return await this.updateSignalStatus(signal, 'HIT_SL', currentPrice, 'Stop loss triggered');
      }

      return null;
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`❌ Error checking signal status for ${signal.symbol}: ${msg}`);
      return null;
    }
  }

  /**
   * Update signal status in database
   * Returns update info for notification
   */
  private async updateSignalStatus(
    signal: Signal,
    newStatus: Signal['status'],
    exitPrice: number,
    exitReason: string
  ): Promise<{
    signal: Signal;
    status: Signal['status'];
    exitPrice: number;
    pnlPercent: number;
    pnlAmount: number;
  }> {
    const pnlPercent = pnlService.calculatePnLPercentage(
      signal.entryPrice,
      exitPrice,
      signal.direction
    );

    const pnlAmount = pnlService.calculatePnL(signal.entryPrice, exitPrice, signal.direction);

    // Update in database
    await SignalModel.updateOne(
      { _id: (signal as unknown as { _id: string })._id },
      {
        $set: {
          status: newStatus,
          exitPrice,
          exitReason,
          pnl: pnlPercent,
        },
      }
    );

    logger.info(
      `✅ Signal ${signal.symbol} updated: ${newStatus} at ${exitPrice} (${pnlService.formatPnLPercentage(pnlPercent)})`
    );

    return {
      signal,
      status: newStatus,
      exitPrice,
      pnlPercent,
      pnlAmount,
    };
  }
}

export const signalMonitorService = new SignalMonitorService();

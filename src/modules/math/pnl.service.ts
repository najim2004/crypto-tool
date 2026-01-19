/**
 * Profit and Loss Calculation Service
 * Provides utilities for calculating and formatting P&L
 */
export class PnlService {
  /**
   * Calculate profit/loss amount
   * @param entry - Entry price
   * @param exit - Exit price
   * @param direction - Trade direction
   * @returns P/L amount (positive for profit, negative for loss)
   */
  calculatePnL(entry: number, exit: number, direction: 'LONG' | 'SHORT'): number {
    if (direction === 'LONG') {
      return exit - entry;
    } else {
      return entry - exit;
    }
  }

  /**
   * Calculate P/L percentage
   * @param entry - Entry price
   * @param exit - Exit price
   * @param direction - Trade direction
   * @returns P/L percentage
   */
  calculatePnLPercentage(entry: number, exit: number, direction: 'LONG' | 'SHORT'): number {
    if (entry === 0) return 0;

    const pnl = this.calculatePnL(entry, exit, direction);
    return (pnl / entry) * 100;
  }

  /**
   * Calculate unrealized P/L for an open position
   * @param entry - Entry price
   * @param current - Current market price
   * @param direction - Trade direction
   * @returns Unrealized P/L percentage
   */
  calculateUnrealizedPnL(entry: number, current: number, direction: 'LONG' | 'SHORT'): number {
    return this.calculatePnLPercentage(entry, current, direction);
  }

  /**
   * Format P/L for display
   * @param pnl - P/L value (amount or percentage)
   * @param withSign - Whether to include + sign for positive values
   * @param decimals - Number of decimal places
   * @returns Formatted P/L string
   */
  formatPnL(pnl: number, withSign: boolean = true, decimals: number = 2): string {
    const sign = withSign && pnl > 0 ? '+' : '';
    return `${sign}${pnl.toFixed(decimals)}`;
  }

  /**
   * Format P/L percentage for display
   * @param pnlPercent - P/L percentage value
   * @param withSign - Whether to include + sign for positive values
   * @returns Formatted P/L percentage string with % sign
   */
  formatPnLPercentage(pnlPercent: number, withSign: boolean = true): string {
    const sign = withSign && pnlPercent > 0 ? '+' : '';
    return `${sign}${pnlPercent.toFixed(2)}%`;
  }

  /**
   * Check if position is in profit
   * @param entry - Entry price
   * @param current - Current price
   * @param direction - Trade direction
   * @returns True if in profit
   */
  isInProfit(entry: number, current: number, direction: 'LONG' | 'SHORT'): boolean {
    const pnl = this.calculatePnL(entry, current, direction);
    return pnl > 0;
  }

  /**
   * Check if position is in loss
   * @param entry - Entry price
   * @param current - Current price
   * @param direction - Trade direction
   * @returns True if in loss
   */
  isInLoss(entry: number, current: number, direction: 'LONG' | 'SHORT'): boolean {
    const pnl = this.calculatePnL(entry, current, direction);
    return pnl < 0;
  }

  /**
   * Calculate potential P/L at a given price
   * @param entry - Entry price
   * @param targetPrice - Target price to calculate P/L for
   * @param direction - Trade direction
   * @returns Potential P/L percentage
   */
  calculatePotentialPnL(entry: number, targetPrice: number, direction: 'LONG' | 'SHORT'): number {
    return this.calculatePnLPercentage(entry, targetPrice, direction);
  }
}

export const pnlService = new PnlService();

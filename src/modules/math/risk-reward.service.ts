/**
 * Risk-Reward Calculation Service
 * Provides utilities for calculating and validating risk-reward ratios
 */
export class RiskRewardService {
  /**
   * Calculate risk-reward ratio for a trade
   * @param entry - Entry price
   * @param stopLoss - Stop loss price
   * @param takeProfit - Take profit price
   * @returns Risk-reward ratio (e.g., 2.0 means 2:1 R:R)
   */
  calculateRatio(entry: number, stopLoss: number, takeProfit: number): number {
    const risk = Math.abs(entry - stopLoss);
    const reward = Math.abs(takeProfit - entry);

    if (risk === 0) return 0;
    return reward / risk;
  }

  /**
   * Calculate current position in the risk zone
   * @param current - Current price
   * @param entry - Entry price
   * @param stopLoss - Stop loss price
   * @param direction - Trade direction
   * @returns Position value: 0 = at entry, 1 = at SL, -1 = at TP (for LONG)
   */
  calculateRiskPosition(
    current: number,
    entry: number,
    stopLoss: number,
    direction: 'LONG' | 'SHORT'
  ): number {
    const risk = Math.abs(entry - stopLoss);
    if (risk === 0) return 0;

    const currentDistance = direction === 'LONG' ? entry - current : current - entry;
    return currentDistance / risk;
  }

  /**
   * Validate if risk-reward ratio meets minimum threshold
   * @param ratio - Calculated R:R ratio
   * @param minRatio - Minimum acceptable ratio
   * @returns True if ratio meets or exceeds minimum
   */
  validateRatio(ratio: number, minRatio: number = 2.0): boolean {
    return ratio >= minRatio;
  }

  /**
   * Calculate required take profit price for a desired R:R ratio
   * @param entry - Entry price
   * @param stopLoss - Stop loss price
   * @param desiredRatio - Desired risk-reward ratio
   * @param direction - Trade direction
   * @returns Required take profit price
   */
  calculateRequiredTP(
    entry: number,
    stopLoss: number,
    desiredRatio: number,
    direction: 'LONG' | 'SHORT'
  ): number {
    const risk = Math.abs(entry - stopLoss);
    const reward = risk * desiredRatio;

    if (direction === 'LONG') {
      return entry + reward;
    } else {
      return entry - reward;
    }
  }

  /**
   * Check if current price is approaching stop loss
   * @param current - Current price
   * @param entry - Entry price
   * @param stopLoss - Stop loss price
   * @param direction - Trade direction
   * @param threshold - Percentage of risk distance (0.5 = 50%)
   * @returns True if approaching SL
   */
  isApproachingSL(
    current: number,
    entry: number,
    stopLoss: number,
    direction: 'LONG' | 'SHORT',
    threshold: number = 0.5
  ): boolean {
    const position = this.calculateRiskPosition(current, entry, stopLoss, direction);
    return position >= threshold;
  }

  /**
   * Check if current price has hit stop loss
   * @param current - Current price
   * @param stopLoss - Stop loss price
   * @param direction - Trade direction
   * @returns True if SL has been hit
   */
  hasHitSL(current: number, stopLoss: number, direction: 'LONG' | 'SHORT'): boolean {
    if (direction === 'LONG') {
      return current <= stopLoss;
    } else {
      return current >= stopLoss;
    }
  }

  /**
   * Check if current price has hit take profit
   * @param current - Current price
   * @param takeProfit - Take profit price
   * @param direction - Trade direction
   * @returns True if TP has been hit
   */
  hasHitTP(current: number, takeProfit: number, direction: 'LONG' | 'SHORT'): boolean {
    if (direction === 'LONG') {
      return current >= takeProfit;
    } else {
      return current <= takeProfit;
    }
  }
}

export const riskRewardService = new RiskRewardService();

export class MoneyManagementService {
  /**
   * Calculate Kelly Criterion Percentage
   * F = p - (q / b)
   * where:
   * p = probability of win
   * q = probability of loss (1 - p)
   * b = odds received (reward / risk)
   *
   * Returns a SAFE percentage (Half-Kelly or Quarter-Kelly usually recommended)
   */
  calculateKellyPosition(
    winRate: number, // 0 to 1 (e.g. 0.55)
    rewardtoRisk: number, // e.g. 2.0
    fraction: number = 0.5 // Default to Half-Kelly for safety
  ): number {
    if (rewardtoRisk <= 0) return 0;

    // F = p - (q / b) ==> F = p - ((1-p)/b)
    const p = winRate;
    const q = 1 - p;
    const b = rewardtoRisk;

    const kelly = p - q / b;

    if (kelly <= 0) return 0;

    // Apply fractional sizing (safe mode)
    // Capping max allocation to avoid ruin (e.g., max 25% of bankroll per trade is insane for crypto, usually max 5%)
    // This function returns the "Kelly Fraction", the caller must apply it to portfolio limits.
    const safeKelly = kelly * fraction;

    // Hard cap at 5% for risk management safety in this highly volatile context
    return Math.min(safeKelly, 0.05);
  }

  /**
   * Calculate Position Size based on Risk Amount
   * @param accountBalance Total Balance
   * @param riskPercentage Risk per trade (e.g. 0.01 for 1%)
   * @param entryPrice Entry
   * @param stopLoss Stop Loss
   */
  calculateRiskBasedPosition(
    accountBalance: number,
    riskPercentage: number,
    entryPrice: number,
    stopLoss: number
  ): number {
    const riskAmount = accountBalance * riskPercentage;
    const riskPerUnit = Math.abs(entryPrice - stopLoss);

    if (riskPerUnit === 0) return 0;

    return riskAmount / riskPerUnit;
  }
}

export const moneyManagementService = new MoneyManagementService();

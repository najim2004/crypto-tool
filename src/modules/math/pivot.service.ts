export class PivotService {
  /**
   * Calculate Standard Pivot Points
   */
  calculateStandardPivots(
    high: number,
    low: number,
    close: number
  ): {
    p: number;
    r1: number;
    r2: number;
    s1: number;
    s2: number;
  } {
    const p = (high + low + close) / 3;

    const r1 = 2 * p - low;
    const s1 = 2 * p - high;

    const r2 = p + (high - low);
    const s2 = p - (high - low);

    return { p, r1, r2, s1, s2 };
  }

  /**
   * Find nearest support and resistance relative to current price
   */
  findNearestLevels(
    currentPrice: number,
    pivots: { p: number; r1: number; r2: number; s1: number; s2: number }
  ): { nearestSupport: number; nearestResistance: number } {
    const levels = [pivots.s2, pivots.s1, pivots.p, pivots.r1, pivots.r2].sort((a, b) => a - b);

    // Default to extremes
    let nearestSupport = pivots.s2;
    let nearestResistance = pivots.r2;

    for (let i = 0; i < levels.length; i++) {
      if (currentPrice < levels[i]) {
        nearestResistance = levels[i];
        nearestSupport = levels[i - 1] !== undefined ? levels[i - 1] : pivots.s2; // fallback
        break;
      }
    }

    if (currentPrice > levels[levels.length - 1]) {
      nearestSupport = levels[levels.length - 1]; // Support is R2
      nearestResistance = levels[levels.length - 1] * 1.01; // Projection
    }

    return { nearestSupport, nearestResistance };
  }
}

export const pivotService = new PivotService();

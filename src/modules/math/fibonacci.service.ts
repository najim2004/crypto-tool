export class FibonacciService {
  /**
   * Calculate Fibonacci Retracements based on recent swing high/low
   * Simplistic implementation: Looks at lookback period to find High/Low
   */
  calculateRetracements(
    high: number,
    low: number,
    currentPrice: number,
    trend: 'UP' | 'DOWN'
  ): {
    level0: number;
    level236: number;
    level382: number;
    level500: number;
    level618: number;
    level100: number;
  } {
    const diff = high - low;

    if (trend === 'UP') {
      // Retracing DOWN from High
      return {
        level0: high, // 0% retracement (Top)
        level236: high - diff * 0.236,
        level382: high - diff * 0.382,
        level500: high - diff * 0.5,
        level618: high - diff * 0.618,
        level100: low, // 100% retracement (Bottom)
      };
    } else {
      // Retracing UP from Low
      return {
        level0: low,
        level236: low + diff * 0.236,
        level382: low + diff * 0.382,
        level500: low + diff * 0.5,
        level618: low + diff * 0.618,
        level100: high,
      };
    }
  }

  /**
   * Calculate Extension (1.618)
   */
  calculateExtension(high: number, low: number, trend: 'UP' | 'DOWN'): number {
    const diff = high - low;
    if (trend === 'UP') {
      return high + diff * 0.618;
    } else {
      return low - diff * 0.618;
    }
  }
}

export const fibonacciService = new FibonacciService();

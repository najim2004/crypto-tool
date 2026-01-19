import { Candle } from '../../interface/trading.interface.js';

export class MomentumMathService {
  /**
   * Calculate Stochastic Oscillator
   * %K = (Current Close - Lowest Low) / (Highest High - Lowest Low) * 100
   * %D = 3-day SMA of %K
   */
  calculateStochastic(
    klines: Candle[],
    period: number = 14,
    smoothK: number = 3,
    smoothD: number = 3
  ): { k: number; d: number } {
    if (klines.length < period) return { k: 50, d: 50 }; // Default neutral

    // Helper to calculate %K for a single point
    const calculateK = (window: Candle[]): number => {
      const close = window[window.length - 1].close;
      const low = Math.min(...window.map(c => c.low));
      const high = Math.max(...window.map(c => c.high));

      if (high === low) return 50;
      return ((close - low) / (high - low)) * 100;
    };

    // Calculate raw %K series for smoothing
    // We need enough data points to smooth %D.
    // Minimal needed: period + smoothK + smoothD
    const needed = period + smoothK + smoothD;
    const data = klines.slice(-needed * 2); // Get plenty safety buffer

    const rawKValues: number[] = [];

    // We calculate a rolling window for raw %K
    for (let i = period; i <= data.length; i++) {
      const window = data.slice(i - period, i);
      rawKValues.push(calculateK(window));
    }

    // Smooth %K (if smoothK > 1, usually 1 or 3)
    const smooth = (values: number[], period: number) => {
      if (values.length < period) return values[values.length - 1];
      const slice = values.slice(-period);
      return slice.reduce((a, b) => a + b, 0) / period;
    };

    const currentK = smooth(rawKValues, smoothK);

    // To calculate %D, we would technically need a history of smoothed %K values.
    // For simplicity/efficiency in this first pass, we approximation:
    // We just return the current K and a simple moving average of the last few raw Ks as D if smoothK=1
    // A proper implementation requires storing the history.
    // Let's do a simple calculation based on the last few candles (approximation) as realtime varies.

    // Robust way:
    const kSeries: number[] = [];
    // Recalculate last [smoothD] smoothed K values
    for (let i = 0; i < smoothD; i++) {
      const endIdx = rawKValues.length - i;
      const startIdx = endIdx - smoothK;
      if (startIdx >= 0) {
        const chunk = rawKValues.slice(startIdx, endIdx);
        const val = chunk.reduce((a, b) => a + b, 0) / chunk.length;
        kSeries.unshift(val);
      }
    }

    const currentD = kSeries.reduce((a, b) => a + b, 0) / kSeries.length || 50;

    return { k: currentK, d: currentD };
  }

  /**
   * Calculate Williams %R
   * (Highest High - Close) / (Highest High - Lowest Low) * -100
   */
  calculateWilliamsR(klines: Candle[], period: number = 14): number {
    if (klines.length < period) return -50;

    const window = klines.slice(-period);
    const close = window[window.length - 1].close;
    const low = Math.min(...window.map(c => c.low));
    const high = Math.max(...window.map(c => c.high));

    if (high === low) return -50;
    return ((high - close) / (high - low)) * -100;
  }
}

export const momentumMathService = new MomentumMathService();

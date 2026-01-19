import { Candle } from '../../interface/trading.interface.js';

export class VolatilityService {
  /**
   * Calculate Bollinger Bands
   * @param klines Array of candles (last one is current)
   * @param period Period for SMA (default 20)
   * @param stdDevMultiplier Multiplier for StdDev (default 2)
   */
  calculateBollingerBands(
    klines: Candle[],
    period: number = 20,
    stdDevMultiplier: number = 2
  ): { upper: number; middle: number; lower: number; bandwidth: number; percentB: number } {
    if (klines.length < period) {
      // Not enough data
      return { upper: 0, middle: 0, lower: 0, bandwidth: 0, percentB: 0 };
    }

    const relevantKlines = klines.slice(-period);
    const sum = relevantKlines.reduce((acc, k) => acc + k.close, 0);
    const middle = sum / period; // SMA

    const squaredDiifs = relevantKlines.map(k => Math.pow(k.close - middle, 2));
    const avgSquaredDiff = squaredDiifs.reduce((acc, val) => acc + val, 0) / period;
    const stdDev = Math.sqrt(avgSquaredDiff);

    const upper = middle + stdDev * stdDevMultiplier;
    const lower = middle - stdDev * stdDevMultiplier;
    const bandwidth = ((upper - lower) / middle) * 100;

    // %B Calculation: Position of price within bands
    const currentClose = klines[klines.length - 1].close;
    let percentB = (currentClose - lower) / (upper - lower);

    // Handle division by zero edge case
    if (isNaN(percentB)) percentB = 0.5;

    return { upper, middle, lower, bandwidth, percentB };
  }
}

export const volatilityService = new VolatilityService();

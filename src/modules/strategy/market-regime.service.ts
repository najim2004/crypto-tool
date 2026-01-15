import { Candle } from '../../interface/trading.interface.js';
import { indicatorService } from './indicator.service.js';

export type MarketRegimeType = 'TRENDING_UP' | 'TRENDING_DOWN' | 'RANGING' | 'CHOPPY';

export class MarketRegimeService {
  /**
   * Analyzes the market regime based on 4H trend, 1H ADX, and SMA alignment.
   */
  detectRegime(
    klines4h: Candle[],
    ind1h: { adx: number; ema50: number; sma200: number },
    close1h: number
  ): { type: MarketRegimeType; details: string } {
    // 1. Long-Term Trend (4H)
    // We compute basic indicators for 4H here to save passing them around
    const ind4h = indicatorService.computeIndicators(klines4h);
    const close4h = klines4h[klines4h.length - 1].close;

    const is4hBullish = close4h > ind4h.ema50;
    const is4hBearish = close4h < ind4h.ema50;

    // 2. Trend Strength (1H ADX)
    const isStrongTrend = ind1h.adx > 25;
    const isWeakTrend = ind1h.adx < 20;

    // 3. Alignment (1H vs 4H)
    const alignedBullish = is4hBullish && close1h > ind1h.ema50;
    const alignedBearish = is4hBearish && close1h < ind1h.ema50;

    // 4. Regime Detection Logic
    if (isStrongTrend) {
      if (alignedBullish)
        return { type: 'TRENDING_UP', details: 'Strong Bullish Alignment (4H+1H)' };
      if (alignedBearish)
        return { type: 'TRENDING_DOWN', details: 'Strong Bearish Alignment (4H+1H)' };
    }

    if (isWeakTrend) {
      // Check for Chop (Frequent SMA crosses or very low ADX)
      if (ind1h.adx < 15) return { type: 'CHOPPY', details: 'Very Low ADX (<15)' };
      return { type: 'RANGING', details: 'Weak Trend (ADX < 20)' };
    }

    // Mixed Conditions (e.g. ADX > 20 but Price < EMA50 while 4H > EMA50)
    return { type: 'RANGING', details: 'Mixed Signals / Retracement' };
  }
}

export const marketRegimeService = new MarketRegimeService();

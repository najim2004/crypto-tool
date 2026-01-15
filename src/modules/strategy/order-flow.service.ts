import { Candle } from '../../interface/trading.interface.js';

export class OrderFlowService {
  /**
   * Calculates the Net Volume Delta (Buying Pressure vs Selling Pressure)
   * Formula: Taker Buy Volume - (Total Volume - Taker Buy Volume)
   * Note: 'Total Volume - Taker Buy Volume' approximates Taker Sell Volume
   */
  calculateDelta(candle: Candle): number {
    const takerBuyVol = candle.takerBuyVolume || 0;
    const takerSellVol = candle.volume - takerBuyVol;
    return takerBuyVol - takerSellVol;
  }

  /**
   * Analyzes Trade Intensity to detect "Whale Activity"
   * High Volume + Low Trade Count = Large average trade size (Whales)
   */
  analyzeTradeIntensity(candle: Candle, averageTradeSize: number): 'WHALE' | 'RETAIL' | 'NORMAL' {
    if (!candle.tradeCount || candle.tradeCount === 0) return 'NORMAL';

    const currentAvgSize = candle.volume / candle.tradeCount;

    // If current trade size is significantly larger (e.g., 2.5x) than the moving average
    if (currentAvgSize > averageTradeSize * 2.5) {
      return 'WHALE';
    }

    // If current trade size is very small but volume is high (Retail FOMO/Panic)
    if (currentAvgSize < averageTradeSize * 0.5) {
      return 'RETAIL';
    }

    return 'NORMAL';
  }

  /**
   * Computes average trade size over a period for baseline
   */
  computeAverageTradeSize(candles: Candle[]): number {
    let totalVol = 0;
    let totalTrades = 0;

    candles.forEach(c => {
      totalVol += c.volume;
      totalTrades += c.tradeCount || 0;
    });

    if (totalTrades === 0) return 0;
    return totalVol / totalTrades;
  }
}

export const orderFlowService = new OrderFlowService();

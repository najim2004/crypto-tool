import { binanceService } from '../binance/binance.service.js';
import { indicatorService } from './indicator.service.js';
import { Signal } from '../../interface/trading.interface.js';

export class StrategyService {
  private readonly SYMBOL = 'BTCUSDT';

  async evaluate(): Promise<Signal | null> {
    const klines1h = await binanceService.fetchKlines(this.SYMBOL, '1h', 100);
    const klines15m = await binanceService.fetchKlines(this.SYMBOL, '15m', 100);
    const klines5m = await binanceService.fetchKlines(this.SYMBOL, '5m', 100);

    const ind1h = indicatorService.computeIndicators(klines1h);
    const ind15m = indicatorService.computeIndicators(klines15m);
    const ind5m = indicatorService.computeIndicators(klines5m);

    const lastClose1h = klines1h[klines1h.length - 1].close;
    const lastClose15m = klines15m[klines15m.length - 1].close;
    const lastClose5m = klines5m[klines5m.length - 1].close;

    // 1. Higher Timeframe (1H) Trend Check
    const trend1h = indicatorService.isTrending(ind1h.ema50, lastClose1h, ind1h.rsi);

    if (trend1h === 'RANGE') return null;

    // 2. Medium Timeframe (15m) Momentum Confirmation
    if (trend1h === 'UP') {
      if (lastClose15m < ind15m.vwap || ind15m.macd.histogram < 0 || ind15m.rsi > 70) {
        return null;
      }
    } else {
      if (lastClose15m > ind15m.vwap || ind15m.macd.histogram > 0 || ind15m.rsi < 30) {
        return null;
      }
    }

    // 3. Lower Timeframe (5m) Trigger
    if (trend1h === 'UP') {
      const isTriggered =
        lastClose5m > ind5m.ema20! && lastClose5m > ind5m.vwap && ind5m.macd.histogram > 0;
      if (!isTriggered) return null;

      // Risk Management (2:1 R:R)
      const entry = lastClose5m;
      const stopLoss = entry - ind5m.atr * 2;
      const takeProfit = entry + ind5m.atr * 4; // 2:1 ratio

      return {
        symbol: this.SYMBOL,
        direction: 'LONG',
        entryPrice: entry,
        stopLoss,
        takeProfit,
        timestamp: new Date(),
        status: 'OPEN',
      };
    } else {
      const isTriggered =
        lastClose5m < ind5m.ema20! && lastClose5m < ind5m.vwap && ind5m.macd.histogram < 0;
      if (!isTriggered) return null;

      const entry = lastClose5m;
      const stopLoss = entry + ind5m.atr * 2;
      const takeProfit = entry - ind5m.atr * 4; // 2:1 ratio

      return {
        symbol: this.SYMBOL,
        direction: 'SHORT',
        entryPrice: entry,
        stopLoss,
        takeProfit,
        timestamp: new Date(),
        status: 'OPEN',
      };
    }
  }
}

export const strategyService = new StrategyService();

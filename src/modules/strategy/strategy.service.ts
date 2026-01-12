import { binanceService } from '../binance/binance.service.js';
import { indicatorService } from './indicator.service.js';
import { Signal } from '../../interface/trading.interface.js';
import logger from '../../utils/logger.js';
import { aiService } from '../ai/ai.service.js';

export class StrategyService {
  private readonly SYMBOLS = ['PEPEUSDT', 'DOGEUSDT', 'XRPUSDT', 'ADAUSDT', 'POLUSDT', 'FTMUSDT'];
  // Cache key: symbol, Value: { data: regimeData, timestamp: number }
  private regimeCache = new Map<
    string,
    { data: { regime: string; confidence: number; reasoning: string }; timestamp: number }
  >();

  async evaluateAll(): Promise<Signal[]> {
    const signals: Signal[] = [];

    // 0. Session Filter (13:00 - 17:00 UTC)
    const currentHour = new Date().getUTCHours();
    const isSessionActive = currentHour >= 13 && currentHour < 17;

    if (!isSessionActive) {
      // Log only once per cycle, not per symbol
      logger.info(
        `⏳ [SESSION] Outside trading hours. Current: ${currentHour}:00 UTC. Active: 13:00-17:00 UTC.`
      );
      return [];
    } else {
      logger.info(`✅ [SESSION] Session Active. Current: ${currentHour}:00 UTC.`);
    }

    // Iterate over all symbols
    for (const symbol of this.SYMBOLS) {
      try {
        const signal = await this.evaluateSymbol(symbol);
        if (signal) {
          signals.push(signal);
        }
      } catch (error) {
        logger.error(
          `❌ Error evaluating ${symbol}: ${error instanceof Error ? error.message : 'Unknown'}`
        );
      }
    }

    return signals;
  }

  private async evaluateSymbol(symbol: string): Promise<Signal | null> {
    const klines1h = await binanceService.fetchKlines(symbol, '1h', 100);
    const klines15m = await binanceService.fetchKlines(symbol, '15m', 100);
    const klines5m = await binanceService.fetchKlines(symbol, '5m', 100);

    const ind1h = indicatorService.computeIndicators(klines1h);
    const ind15m = indicatorService.computeIndicators(klines15m);
    const ind5m = indicatorService.computeIndicators(klines5m);

    // 0.5. AI Market Regime Analysis (Cached for 1 hour PER SYMBOL)
    const now = Date.now();
    let marketRegime = this.regimeCache.get(symbol)?.data;
    const lastCheck = this.regimeCache.get(symbol)?.timestamp || 0;

    if (now - lastCheck > 60 * 60 * 1000 || !marketRegime) {
      logger.info(`🔄 [${symbol}] Updating AI Market Regime (Expires in 1h)...`);
      marketRegime = await aiService.analyzeMarketRegime(symbol, klines1h);
      this.regimeCache.set(symbol, { data: marketRegime, timestamp: now });
    }

    if (marketRegime.regime === 'ranging' || marketRegime.confidence < 60) {
      // Log skipped trades once every 10 minutes per symbol to reduce noise
      if (now % 600000 < 10000) {
        logger.info(
          `🚫 [AI REGIME] ${symbol}: Unfavorable (${marketRegime.regime}, ${marketRegime.confidence}%). Reason: ${marketRegime.reasoning}`
        );
      }
      return null;
    }

    const lastClose1h = klines1h[klines1h.length - 1].close;
    const lastClose15m = klines15m[klines15m.length - 1].close;
    const lastClose5m = klines5m[klines5m.length - 1].close;

    // 1. Higher Timeframe (1H) Trend Check (with ADX)
    const trend1h = indicatorService.isTrending(ind1h.ema50, lastClose1h, ind1h.rsi);
    const isStrongTrend = ind1h.adx > 25;

    if (trend1h === 'RANGE' || !isStrongTrend) {
      logger.info(
        `📉 [TREND] ${symbol}: Weak/No Trend (1H). Trend: ${trend1h}, ADX: ${ind1h.adx.toFixed(2)}`
      );
      return null;
    } else {
      logger.info(
        `✅ [TREND] ${symbol}: Strong Trend Detected. Direction: ${trend1h}, ADX: ${ind1h.adx.toFixed(2)}`
      );
    }

    // 2. Medium Timeframe (15m) Momentum Confirmation
    if (trend1h === 'UP') {
      if (lastClose15m < ind15m.vwap || ind15m.macd.histogram < 0 || ind15m.rsi > 70) {
        logger.info(`⚠️ [MOMENTUM] ${symbol}: Long Rejected on 15m.`);
        return null;
      }
    } else {
      if (lastClose15m > ind15m.vwap || ind15m.macd.histogram > 0 || ind15m.rsi < 30) {
        logger.info(`⚠️ [MOMENTUM] ${symbol}: Short Rejected on 15m.`);
        return null;
      }
    }

    // 3. Lower Timeframe (5m) Trigger (with Volume Confirmation)
    const currentVolume = klines5m[klines5m.length - 1].volume;
    const isHighVolume = currentVolume > ind5m.volumeSMA * 2;

    if (!isHighVolume) {
      logger.info(
        `🔈 [VOLUME] ${symbol}: Low Volume on 5m. Curr: ${currentVolume.toFixed(2)}, Avg: ${ind5m.volumeSMA.toFixed(2)}`
      );
      return null;
    }

    if (trend1h === 'UP') {
      const isTriggered =
        lastClose5m > ind5m.ema20! &&
        lastClose5m > ind5m.vwap &&
        ind5m.macd.histogram > 0 &&
        isHighVolume;
      if (!isTriggered) return null;

      // AI-Enhanced Risk Management
      const entry = lastClose5m;
      const riskParams = await aiService.assessRiskParameters(entry, ind5m.atr, 'LONG');
      const stopLoss = entry - ind5m.atr * riskParams.stopLossMultiplier;

      // Calculate split TPs (TP1 at 50% of the target, TP2 at 100%)
      const totalTarget = ind5m.atr * riskParams.takeProfitMultiplier;
      const tp1 = entry + totalTarget * 0.6; // Slightly more than half for safety
      const tp2 = entry + totalTarget;

      return {
        symbol: symbol,
        direction: 'LONG',
        entryPrice: entry,
        entryRange: {
          min: entry * 0.9995, // 0.05% buffer below
          max: entry * 1.0005, // 0.05% buffer above
        },
        stopLoss,
        takeProfit: tp2, // Main TP
        takeProfits: { tp1, tp2 },
        timestamp: new Date(),
        status: 'OPEN',
      };
    } else {
      const isTriggered =
        lastClose5m < ind5m.ema20! &&
        lastClose5m < ind5m.vwap &&
        ind5m.macd.histogram < 0 &&
        isHighVolume;
      if (!isTriggered) return null;

      // AI-Enhanced Risk Management
      const entry = lastClose5m;
      const riskParams = await aiService.assessRiskParameters(entry, ind5m.atr, 'SHORT');
      const stopLoss = entry + ind5m.atr * riskParams.stopLossMultiplier;

      const totalTarget = ind5m.atr * riskParams.takeProfitMultiplier;
      const tp1 = entry - totalTarget * 0.6;
      const tp2 = entry - totalTarget;

      return {
        symbol: symbol,
        direction: 'SHORT',
        entryPrice: entry,
        entryRange: {
          min: entry * 1.0005, // Buffer above for short
          max: entry * 0.9995, // Buffer below for short
        },
        stopLoss,
        takeProfit: tp2,
        takeProfits: { tp1, tp2 },
        timestamp: new Date(),
        status: 'OPEN',
      };
    }
  }
}

export const strategyService = new StrategyService();

import { binanceService } from '../binance/binance.service.js';
import { indicatorService } from './indicator.service.js';
import { marketRegimeService } from './market-regime.service.js';
import { orderFlowService } from './order-flow.service.js';
import { Signal, Candle } from '../../interface/trading.interface.js';
import { Formatter } from '../../utils/formatter.js';
import logger from '../../utils/logger.js';

export class StrategyService {
  private readonly SYMBOLS = [
    'BTCUSDT', // Bitcoin
    'ETHUSDT', // Ethereum
    'SOLUSDT', // Solana
    'BNBUSDT', // Binance Coin
    'XRPUSDT', // Ripple
    'DOGEUSDT', // Dogecoin
    'ADAUSDT', // Cardano
    'AVAXUSDT', // Avalanche
    'TRXUSDT', // Tron
    'LINKUSDT', // Chainlink
    'DOTUSDT', // Polkadot
    'MATICUSDT', // Polygon
    'LTCUSDT', // Litecoin
    'SHIBUSDT', // Shiba Inu
    'PEPEUSDT', // Pepe
    'SUIUSDT', // Sui
    'ARBUSDT', // Arbitrum
    'OPUSDT', // Optimism
    'APTUSDT', // Aptos
    'INJUSDT', // Injective
  ];
  // Cache key: symbol, Value: { data: regimeData, timestamp: number }
  private regimeCache = new Map<
    string,
    { data: { regime: string; confidence: number; reasoning: string }; timestamp: number }
  >();

  async evaluateAll(): Promise<Signal[]> {
    const signals: Signal[] = [];

    // 0. Session Filter (13:00 - 17:00 UTC) - COMMENTED OUT (Crypto is 24/7)
    // const currentHour = new Date().getUTCHours();
    // const isSessionActive = currentHour >= 13 && currentHour < 17;

    // if (!isSessionActive) {
    //   // Log only once per cycle, not per symbol
    //   logger.info(
    //     `⏳ [SESSION] Outside trading hours. Current: ${currentHour}:00 UTC. Active: 13:00-17:00 UTC.`
    //   );
    //   return [];
    // } else {
    //   logger.info(`✅ [SESSION] Session Active. Current: ${currentHour}:00 UTC.`);
    // }

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
    // Helper to remove incomplete candle
    const sanitizeKlines = (data: Candle[], durationMs: number): Candle[] => {
      const last = data[data.length - 1];
      const now = Date.now();
      // If the last candle is still open (or barely closed), potential for data flux.
      // Binance usually includes the current open candle.
      // We check if current time is within the candle's duration.
      if (now < last.time + durationMs) {
        return data.slice(0, -1); // Remove last incomplete candle
      }
      return data;
    };

    const klines1h = sanitizeKlines(await binanceService.fetchKlines(symbol, '1h', 100), 3600000);
    const klines15m = sanitizeKlines(await binanceService.fetchKlines(symbol, '15m', 100), 900000);
    const klines5m = sanitizeKlines(await binanceService.fetchKlines(symbol, '5m', 100), 300000);
    const klines4h = sanitizeKlines(await binanceService.fetchKlines(symbol, '4h', 100), 14400000); // 4 Hour

    const ind1h = indicatorService.computeIndicators(klines1h);
    const ind15m = indicatorService.computeIndicators(klines15m);
    const ind5m = indicatorService.computeIndicators(klines5m);

    const lastClose1h = klines1h[klines1h.length - 1].close;
    const lastClose15m = klines15m[klines15m.length - 1].close;
    const lastClose5m = klines5m[klines5m.length - 1].close;
    const currentVolume = klines5m[klines5m.length - 1].volume;

    // --- Quantitative Analysis (Order Flow) ---
    const lastCandle5m = klines5m[klines5m.length - 1];
    const avgTradeSize = orderFlowService.computeAverageTradeSize(klines5m); // Baseline
    const tradeIntensity = orderFlowService.analyzeTradeIntensity(lastCandle5m, avgTradeSize);
    const delta = orderFlowService.calculateDelta(lastCandle5m);

    // Whales are accumulating if price is stable but big trades are happening?
    // For now, we use it as a strength booster.
    const isWhaleActive = tradeIntensity === 'WHALE';

    // --- 1. Market Regime & Trend Detection ---
    const regime = marketRegimeService.detectRegime(
      klines4h,
      { adx: ind1h.adx, ema50: ind1h.ema50, sma200: 0 },
      lastClose1h
    );

    // Filter: Eliminate Choppy Markets immediately
    if (regime.type === 'CHOPPY') {
      logger.info(`⛔ [FILTER] ${symbol}: Choppy Market Detected (${regime.details})`);
      return null;
    }

    // --- HELPER: Evaluation for a specific tier ---
    const checkTier = (tier: 'PRIME' | 'STANDARD'): Signal | null => {
      const isStrict = tier === 'PRIME';

      // 1. Trend Filter
      // Strict: ADX > 25, RSI Strict
      // Relaxed: ADX > 20, RSI Relaxed
      const minAdx = isStrict ? 25 : 20;
      const trend1h = indicatorService.isTrending(ind1h.ema50, lastClose1h, ind1h.rsi, isStrict);
      const isAdxValid = ind1h.adx > minAdx;

      if (trend1h === 'RANGE' || !isAdxValid) {
        if (!isStrict) {
          // Only log on relaxed (final) failure
          logger.info(
            `📉 [${tier}] ${symbol}: Weak Trend. Trend: ${trend1h}, ADX: ${ind1h.adx.toFixed(2)} (<${minAdx})`
          );
        }
        return null;
      }

      // 2. Volume Trigger
      // Strict: > 2.0x SMA
      // Relaxed: > 1.0x SMA (Above Average)
      const volThreshold = isStrict ? 2.0 : 1.0;
      const isAggrVolume = currentVolume > ind5m.volumeSMA * volThreshold;

      if (!isAggrVolume) {
        if (!isStrict) {
          logger.info(
            `🔈 [${tier}] ${symbol}: Low Volume. x${(currentVolume / ind5m.volumeSMA).toFixed(1)} (< x${volThreshold})`
          );
        }
        return null;
      }

      // 3. PRIME Quantitative Confirmations
      if (tier === 'PRIME') {
        // Trend alignment check (existing)
        const close4h = klines4h[klines4h.length - 1].close;
        const ind4h = indicatorService.computeIndicators(klines4h);
        const trend4h = close4h > ind4h.ema50 ? 'UP' : 'DOWN';
        if (trend1h !== trend4h) {
          logger.info(`⚠️ [PRIME] ${symbol}: Trend Mismatch`);
          return null;
        }

        // Order Flow Check:
        // If LONG, we want positive delta (Buying Pressure)
        // If SHORT, we want negative delta (Selling Pressure)
        if (trend1h === 'UP' && delta < 0) {
          logger.info(
            `⚠️ [PRIME] ${symbol}: Negative Delta on Bullish Signal (${delta.toFixed(2)})`
          );
          return null;
        }
        if (trend1h === 'DOWN' && delta > 0) {
          logger.info(
            `⚠️ [PRIME] ${symbol}: Positive Delta on Bearish Signal (${delta.toFixed(2)})`
          );
          return null;
        }
      }

      // 3. Confluence Configs (RSI & VWAP)
      // Strict: RSI [40-65] / [35-60]
      // Relaxed: RSI [40-70] / [30-60]
      const rsiBounds = {
        long: isStrict ? { min: 40, max: 65 } : { min: 40, max: 70 },
        short: isStrict ? { min: 35, max: 60 } : { min: 30, max: 60 },
      };

      const validRsiLong =
        ind1h.rsi > rsiBounds.long.min &&
        ind1h.rsi < rsiBounds.long.max &&
        ind15m.rsi > rsiBounds.long.min &&
        ind15m.rsi < rsiBounds.long.max &&
        ind5m.rsi > rsiBounds.long.min &&
        ind5m.rsi < rsiBounds.long.max;

      const validRsiShort =
        ind1h.rsi < rsiBounds.short.max &&
        ind1h.rsi > rsiBounds.short.min &&
        ind15m.rsi < rsiBounds.short.max &&
        ind15m.rsi > rsiBounds.short.min &&
        ind5m.rsi < rsiBounds.short.max &&
        ind5m.rsi > rsiBounds.short.min;

      // VWAP & MACD (Same for both for safety, but check Strict logic if needed)
      // We keep VWAP consistent as a safety baseline.
      const aboveVwap =
        lastClose1h > ind1h.vwap && lastClose15m > ind15m.vwap && lastClose5m > ind5m.vwap;
      const belowVwap =
        lastClose1h < ind1h.vwap && lastClose15m < ind15m.vwap && lastClose5m < ind5m.vwap;

      const macdBull =
        ind1h.macd.histogram > 0 && ind15m.macd.histogram > 0 && ind5m.macd.histogram > 0;
      const macdBear =
        ind1h.macd.histogram < 0 && ind15m.macd.histogram < 0 && ind5m.macd.histogram < 0;

      // 4. Trigger Check
      // 4. Trigger Check
      if (trend1h === 'UP') {
        if (!validRsiLong) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: RSI mismatch. 1H:${ind1h.rsi.toFixed(1)} (Req: ${rsiBounds.long.min}-${rsiBounds.long.max}), 15m:${ind15m.rsi.toFixed(1)}, 5m:${ind5m.rsi.toFixed(1)}`
            );
          return null;
        }
        if (!aboveVwap) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: Not above VWAP. Close: ${Formatter.formatPrice(lastClose5m)}, VWAP: ${Formatter.formatPrice(ind5m.vwap)}`
            );
          return null;
        }
        if (!macdBull) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: MACD not bullish. Histograms: 1H:${Formatter.formatPrice(ind1h.macd.histogram)}, 15m:${Formatter.formatPrice(ind15m.macd.histogram)}, 5m:${Formatter.formatPrice(ind5m.macd.histogram)}`
            );
          return null;
        }

        // Entry Trigger
        const isTriggered = lastClose5m > ind5m.ema20! && lastClose5m > ind5m.vwap;
        if (!isTriggered) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: No Entry Trigger. Close: ${Formatter.formatPrice(lastClose5m)}, EMA20: ${ind5m.ema20 ? Formatter.formatPrice(ind5m.ema20) : 'N/A'}, VWAP: ${Formatter.formatPrice(ind5m.vwap)}`
            );
          return null;
        }

        // Passed! Construct Signal
        const entry = lastClose5m;
        const stopLoss = entry - ind5m.atr * 2;
        const totalTarget = ind5m.atr * 6;
        const tp1 = entry + totalTarget * 0.6;
        const tp2 = entry + totalTarget;

        return {
          symbol,
          direction: 'LONG',
          quality: tier,
          entryPrice: entry,
          entryRange: { min: entry * 0.9995, max: entry * 1.0005 },
          stopLoss,
          takeProfit: tp2,
          takeProfits: { tp1, tp2 },
          timestamp: new Date(),
          status: 'OPEN',
          technicalContext: {
            rsi: { '1h': ind1h.rsi, '15m': ind15m.rsi, '5m': ind5m.rsi },
            adx: ind1h.adx,
            volumeRatio: parseFloat((currentVolume / ind5m.volumeSMA).toFixed(2)),
            trend: trend1h,
            regime: regime.type,
            delta: parseFloat(delta.toFixed(2)),
            whaleActivity: isWhaleActive,
          },
        };
      } else {
        // DOWN
        if (!validRsiShort) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: RSI mismatch. 1H:${ind1h.rsi.toFixed(1)} (Req: ${rsiBounds.short.min}-${rsiBounds.short.max}), 15m:${ind15m.rsi.toFixed(1)}, 5m:${ind5m.rsi.toFixed(1)}`
            );
          return null;
        }
        if (!belowVwap) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: Not below VWAP. Close: ${Formatter.formatPrice(lastClose5m)}, VWAP: ${Formatter.formatPrice(ind5m.vwap)}`
            );
          return null;
        }
        if (!macdBear) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: MACD not bearish. Histograms: 1H:${Formatter.formatPrice(ind1h.macd.histogram)}, 15m:${Formatter.formatPrice(ind15m.macd.histogram)}, 5m:${Formatter.formatPrice(ind5m.macd.histogram)}`
            );
          return null;
        }

        const isTriggered = lastClose5m < ind5m.ema20! && lastClose5m < ind5m.vwap;
        if (!isTriggered) {
          if (!isStrict)
            logger.info(
              `⚠️ [${tier}] ${symbol}: No Entry Trigger. Close: ${Formatter.formatPrice(lastClose5m)}, EMA20: ${ind5m.ema20 ? Formatter.formatPrice(ind5m.ema20) : 'N/A'}, VWAP: ${Formatter.formatPrice(ind5m.vwap)}`
            );
          return null;
        }

        const entry = lastClose5m;
        const stopLoss = entry + ind5m.atr * 2;
        const totalTarget = ind5m.atr * 6;
        const tp1 = entry - totalTarget * 0.6;
        const tp2 = entry - totalTarget;

        return {
          symbol,
          direction: 'SHORT',
          quality: tier,
          entryPrice: entry,
          entryRange: { min: entry * 1.0005, max: entry * 0.9995 },
          stopLoss,
          takeProfit: tp2,
          takeProfits: { tp1, tp2 },
          timestamp: new Date(),
          status: 'OPEN',
          technicalContext: {
            rsi: { '1h': ind1h.rsi, '15m': ind15m.rsi, '5m': ind5m.rsi },
            adx: ind1h.adx,
            volumeRatio: parseFloat((currentVolume / ind5m.volumeSMA).toFixed(2)),
            trend: trend1h,
            regime: regime.type,
            delta: parseFloat(delta.toFixed(2)),
            whaleActivity: isWhaleActive,
          },
        };
      }
    };

    // --- EVALUATION ---
    // 1. Try PRIME (Strict)
    const primeSignal = checkTier('PRIME');
    if (primeSignal) {
      logger.info(`🔥 [PRIME] ${symbol} Signal Found!`);
      return primeSignal;
    }

    // 2. Try STANDARD (Relaxed)
    const stdSignal = checkTier('STANDARD');
    if (stdSignal) {
      logger.info(`✅ [STANDARD] ${symbol} Signal Found!`);
      return stdSignal;
    }

    return null;
  }
}

export const strategyService = new StrategyService();

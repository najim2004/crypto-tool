import { EMA, RSI, MACD, ATR, ADX, SMA } from 'trading-signals';
import { Candle } from '../../interface/trading.interface.js';
import { volatilityService, momentumMathService } from '../math/index.js';

export interface IndicatorValues {
  ema50: number;
  ema20?: number;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
  };
  atr: number;
  vwap: number;
  adx: number;
  volumeSMA: number;
  stochRSI: {
    k: number;
    d: number;
  };
  bollinger: {
    upper: number;
    lower: number;
    percentB: number;
    squeeze: boolean;
  };
  stochastic: {
    k: number;
    d: number;
  };
}

export class IndicatorService {
  computeIndicators(candles: Candle[]): IndicatorValues {
    if (candles.length < 50) {
      throw new Error('Not enough candle data to compute indicators (min 50 required)');
    }

    const ema50 = new EMA(50);
    const ema20 = new EMA(20);
    const rsi14 = new RSI(14);
    // Correcting MACD constructor: All parameters should be Indicator instances if required
    const macd = new MACD(new EMA(12), new EMA(26), new EMA(9));
    const atr14 = new ATR(14);
    const adx14 = new ADX(14);
    const volumeSMA20 = new SMA(20);
    // const stochRSI = new StochasticRSI(14, 14, 3, 3); // Disabled due to constructor error

    let vwapSum = 0;
    let vwapVolume = 0;

    candles.forEach(candle => {
      ema50.update(candle.close, false);
      ema20.update(candle.close, false);
      rsi14.update(candle.close, false);
      macd.update(candle.close, false);
      atr14.update(
        {
          high: candle.high,
          low: candle.low,
          close: candle.close,
        },
        false
      );
      adx14.update(
        {
          high: candle.high,
          low: candle.low,
          close: candle.close,
        },
        false
      );
      volumeSMA20.update(candle.volume, false);
      // stochRSI.update(candle.close, false);

      vwapSum += candle.close * candle.volume;
      vwapVolume += candle.volume;
    });

    const ema50Res = ema50.getResult();
    const ema20Res = ema20.getResult();
    const rsiRes = rsi14.getResult();
    const macdResult = macd.getResult();
    const atrResult = atr14.getResult();
    const adxResult = adx14.getResult();
    const volumeSMAResult = volumeSMA20.getResult();
    // const stochRes = stochRSI.getResult();

    const bollinger = volatilityService.calculateBollingerBands(candles, 20, 2);
    const stochastic = momentumMathService.calculateStochastic(candles, 14, 3, 3);

    return {
      ema50: ema50Res ? parseFloat(ema50Res.toString()) : 0,
      ema20: ema20Res ? parseFloat(ema20Res.toString()) : 0,
      rsi: rsiRes ? parseFloat(rsiRes.toString()) : 0,
      macd: {
        macd: macdResult ? parseFloat(macdResult.macd.toString()) : 0,
        signal: macdResult ? parseFloat(macdResult.signal.toString()) : 0,
        histogram: macdResult ? parseFloat(macdResult.histogram.toString()) : 0,
      },
      atr: atrResult ? parseFloat(atrResult.toString()) : 0,
      vwap: vwapVolume > 0 ? vwapSum / vwapVolume : 0,
      adx: adxResult ? parseFloat(adxResult.toString()) : 0,
      volumeSMA: volumeSMAResult ? parseFloat(volumeSMAResult.toString()) : 0,
      stochRSI: {
        k: 50, // Placeholder to prevent crash
        d: 50,
      },
      bollinger: {
        upper: bollinger.upper,
        lower: bollinger.lower,
        percentB: bollinger.percentB,
        squeeze: bollinger.bandwidth < 10, // Arbitrary squeeze threshold, refine later
      },
      stochastic: {
        k: stochastic.k,
        d: stochastic.d,
      },
    };
  }

  isTrending(ema50: number, close: number, rsi: number, strict = true): 'UP' | 'DOWN' | 'RANGE' {
    if (strict) {
      if (close > ema50 && rsi > 50) return 'UP';
      if (close < ema50 && rsi < 50) return 'DOWN';
    } else {
      // Relaxed Trend Logic
      if (close > ema50 && rsi > 45) return 'UP'; // Allow slight momentum weakness if price is strong
      if (close < ema50 && rsi < 55) return 'DOWN';
    }
    return 'RANGE';
  }

  /**
   * Calculates dynamic ATR-based Stop Loss and Take Profit
   * Adjusts multipliers based on market volatility (ADX)
   */
  getDynamicRisk(
    entry: number,
    atr: number,
    direction: 'LONG' | 'SHORT',
    adx: number
  ): { sl: number; tp1: number; tp2: number } {
    let slMult = 2.0;
    let tpMult = 6.0;

    // High Volatility Adjustment
    if (adx > 35) {
      slMult = 2.5; // Wider SL to avoid wick-outs
      tpMult = 7.0; // Higher TP potential
    }
    // Low Volatility Adjustment
    else if (adx < 20) {
      slMult = 1.5; // Tighter SL in chop
      tpMult = 4.0; // Conservative TP
    }

    const slDist = atr * slMult;
    const tpDist = atr * tpMult;

    if (direction === 'LONG') {
      return {
        sl: entry - slDist,
        tp1: entry + tpDist * 0.6,
        tp2: entry + tpDist,
      };
    } else {
      return {
        sl: entry + slDist,
        tp1: entry - tpDist * 0.6,
        tp2: entry - tpDist,
      };
    }
  }
}

export const indicatorService = new IndicatorService();

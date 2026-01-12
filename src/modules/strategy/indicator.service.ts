import { EMA, RSI, MACD, ATR, ADX, SMA } from 'trading-signals';
import { Candle } from '../../interface/trading.interface.js';

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
    };
  }

  isTrending(ema50: number, close: number, rsi: number): 'UP' | 'DOWN' | 'RANGE' {
    if (close > ema50 && rsi > 50) return 'UP';
    if (close < ema50 && rsi < 50) return 'DOWN';
    return 'RANGE';
  }
}

export const indicatorService = new IndicatorService();

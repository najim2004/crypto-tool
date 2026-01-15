import axios from 'axios';
import { Candle, Interval } from '../../interface/trading.interface.js';
import logger from '../../utils/logger.js';
import dotenv from 'dotenv';

dotenv.config();

export class BinanceService {
  private readonly baseUrl =
    process.env.BINANCE_API_URL?.replace('/uiKlines', '') || 'https://api.binance.com/api/v3';
  private readonly klinesEndpoint =
    process.env.BINANCE_API_URL || 'https://api.binance.com/api/v3/klines';

  async fetchKlines(symbol: string, interval: Interval, limit: number = 100): Promise<Candle[]> {
    try {
      const response = await axios.get(this.klinesEndpoint, {
        params: {
          symbol,
          interval,
          limit,
        },
      });

      // Binance returns an array of arrays. Format:
      // [
      //   0: Open time
      //   1: Open
      //   2: High
      //   3: Low
      //   4: Close
      //   5: Volume
      //   6: Close time
      //   7: Quote asset volume
      //   8: Number of trades
      //   9: Taker buy base asset volume
      //   10: Taker buy quote asset volume
      //   11: Ignore
      // ]
      type BinanceKline = [
        number, // 0
        string, // 1
        string, // 2
        string, // 3
        string, // 4
        string, // 5
        number, // 6
        string, // 7
        number, // 8: Trade Count
        string, // 9: Taker Buy Base Volume
        ...unknown[],
      ];

      return (response.data as BinanceKline[]).map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
        tradeCount: k[8],
        takerBuyVolume: parseFloat(k[9]),
      }));
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error fetching klines for ${symbol} ${interval}: ${errMsg}`);
      throw error;
    }
  }

  async fetchPrice(symbol: string): Promise<number> {
    try {
      const response = await axios.get(`${this.baseUrl}/ticker/price`, {
        params: { symbol },
      });
      return parseFloat(response.data.price);
    } catch (error: unknown) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error fetching price for ${symbol}: ${errMsg}`);
      throw error;
    }
  }
}

export const binanceService = new BinanceService();

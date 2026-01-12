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
      //   1499040000000,      // Open time
      //   "0.01634790",       // Open
      //   "0.80000000",       // High
      //   "0.01575800",       // Low
      //   "0.01577100",       // Close
      //   "148976.11427815",  // Volume
      //   ...
      // ]
      type BinanceKline = [
        number, // Open time
        string, // Open
        string, // High
        string, // Low
        string, // Close
        string, // Volume
        ...unknown[], // Other fields ignored
      ];

      return (response.data as BinanceKline[]).map(k => ({
        time: k[0],
        open: parseFloat(k[1]),
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        close: parseFloat(k[4]),
        volume: parseFloat(k[5]),
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

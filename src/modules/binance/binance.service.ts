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

      // Binance returns an array of arrays
      return response.data.map((k: Array<string | number>) => ({
        time: k[0] as number,
        open: parseFloat(k[1] as string),
        high: parseFloat(k[2] as string),
        low: parseFloat(k[3] as string),
        close: parseFloat(k[4] as string),
        volume: parseFloat(k[5] as string),
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

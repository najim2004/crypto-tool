export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export type Interval = '5m' | '15m' | '1h';

export interface Signal {
  symbol: string;
  direction: 'LONG' | 'SHORT';
  entryPrice: number;
  entryRange?: {
    min: number;
    max: number;
  };
  stopLoss: number;
  takeProfit: number; // For backward compatibility / primary TP
  takeProfits?: {
    tp1: number;
    tp2: number;
  };
  timestamp: Date;
  aiScore?: number;
  aiReason?: string;
  status: 'OPEN' | 'HIT_TP' | 'HIT_SL' | 'CLOSED_EOD';
}

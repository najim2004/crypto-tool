export interface Candle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  takerBuyVolume?: number;
  tradeCount?: number;
}

export type Interval = '1m' | '5m' | '15m' | '1h' | '4h';

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
  quality?: 'PREMIUM' | 'STANDARD';
  technicalContext?: {
    rsi: { '1h': number; '15m': number; '5m': number };
    adx: number;
    volumeRatio: number;
    trend: string;
    regime?: string;
    delta?: number;
    whaleActivity?: boolean;
    bollinger?: {
      upper: number;
      lower: number;
      percentB: number;
      squeeze: boolean;
    };
    stochastic?: {
      k: number;
      d: number;
    };
    pivots?: {
      current: string; // e.g., "Between P and R1"
      nextSupport: number;
      nextResistance: number;
    };
  };
  status: 'OPEN' | 'HIT_TP1' | 'HIT_TP2' | 'HIT_SL' | 'EARLY_EXIT' | 'CLOSED_EOD';
  exitPrice?: number;
  exitReason?: string;
  warnings?: string[];
}

import { Schema, model } from 'mongoose';

const signalSchema = new Schema(
  {
    symbol: { type: String, required: true },
    direction: { type: String, enum: ['LONG', 'SHORT'], required: true },
    entryPrice: { type: Number, required: true },
    entryRange: {
      min: { type: Number },
      max: { type: Number },
    },
    stopLoss: { type: Number, required: true },
    takeProfit: { type: Number, required: true },
    takeProfits: {
      tp1: { type: Number },
      tp2: { type: Number },
    },
    timestamp: { type: Date, default: Date.now },
    aiScore: { type: Number },
    aiReason: { type: String },
    quality: { type: String, enum: ['PREMIUM', 'STANDARD'], default: 'STANDARD' },
    status: {
      type: String,
      enum: ['OPEN', 'HIT_TP1', 'HIT_TP2', 'HIT_SL', 'EARLY_EXIT', 'CLOSED_EOD'],
      default: 'OPEN',
    },
    pnl: { type: Number },
    exitPrice: { type: Number },
    exitReason: { type: String },
    warnings: [{ type: String }],
    technicalContext: {
      rsi: {
        '1h': Number,
        '15m': Number,
        '5m': Number,
      },
      adx: Number,
      volumeRatio: Number,
      trend: String,
      regime: String,
      delta: Number,
      whaleActivity: Boolean,
    },
  },
  {
    timestamps: true,
  }
);

export const SignalModel = model('Signal', signalSchema);

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
    status: {
      type: String,
      enum: ['OPEN', 'HIT_TP', 'HIT_SL', 'CLOSED_EOD'],
      default: 'OPEN',
    },
    pnl: { type: Number },
  },
  {
    timestamps: true,
  }
);

export const SignalModel = model('Signal', signalSchema);

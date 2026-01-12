import { GoogleGenerativeAI } from '@google/generative-ai';
import { Signal } from '../../interface/trading.interface.js';
import dotenv from 'dotenv';
import logger from '../../utils/logger.js';

dotenv.config();

export class AIService {
  private genAI: GoogleGenerativeAI | null = null;
  private models: string[] = [
    // 'gemini-3-pro-preview',
    // 'gemini-3-flash-preview',
    'gemini-2.5-flash',
    'gemini-2.5-pro',
  ];

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey !== 'your_gemini_api_key_here') {
      this.genAI = new GoogleGenerativeAI(apiKey);
      logger.info('✅ Gemini AI initialized with fallback models');
    }
  }

  async scoreSignal(signal: Signal, context: string): Promise<{ score: number; reason: string }> {
    if (!this.genAI) {
      logger.warn(
        '⚠️ AI Scoring unavailable (No API Key configured). Using technical analysis only.'
      );
      return { score: 75, reason: 'Technical confluence detected - AI scoring unavailable' };
    }

    const prompt = `
      Analyze the following crypto trade setup and respond with a confidence score (0-100) and brief reasoning.
      
      Market: ${signal.symbol}
      Direction: ${signal.direction}
      Entry: ${signal.entryPrice}
      Stop Loss: ${signal.stopLoss}
      Take Profit: ${signal.takeProfit}
      
      Technical Context:
      ${context}
      
      Respond in JSON format: { "score": number, "reason": "string" }
    `;

    // Try each model until one works
    for (const modelName of this.models) {
      try {
        logger.info(`🤖 Trying AI model: ${modelName}`);
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as { score: number; reason: string };
          logger.info(`✅ AI scoring successful with ${modelName} (Score: ${parsed.score})`);
          return parsed;
        }

        logger.warn(`⚠️ Failed to parse response from ${modelName}, trying next model...`);
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown error';
        logger.warn(`⚠️ Model ${modelName} failed: ${errMsg.substring(0, 100)}`);
        // Continue to next model
      }
    }

    // All models failed, use fallback
    logger.warn('⚠️ All AI models failed, using technical analysis fallback');
    return { score: 75, reason: 'Technical confluence detected - AI temporarily unavailable' };
  }

  async analyzeMarketRegime(
    symbol: string,
    recentCandles: Array<{
      time: number;
      open: number;
      high: number;
      low: number;
      close: number;
      volume: number;
    }>
  ): Promise<{
    regime: 'trending' | 'ranging' | 'volatile';
    confidence: number;
    reasoning: string;
  }> {
    if (!this.genAI) {
      logger.warn('⚠️ AI Market Regime unavailable. Defaulting to trending.');
      return {
        regime: 'trending',
        confidence: 50,
        reasoning: 'AI unavailable - neutral assumption',
      };
    }

    const last24h = recentCandles.slice(-24);
    const priceRange = Math.max(...last24h.map(c => c.high)) - Math.min(...last24h.map(c => c.low));
    const avgPrice = last24h.reduce((sum, c) => sum + c.close, 0) / last24h.length;
    const volatility = ((priceRange / avgPrice) * 100).toFixed(2);

    const prompt = `
You are an expert crypto trader analyzing ${symbol} market conditions.

Last 24 hours data:
- Price Range: ${priceRange.toFixed(6)}
- Average Price: ${avgPrice.toFixed(6)}
- Volatility: ${volatility}%
- Volume Trend: ${last24h[last24h.length - 1].volume > last24h[0].volume ? 'Increasing' : 'Decreasing'}

Determine the current market regime:
- "trending": Clear directional movement (good for trend-following)
- "ranging": Sideways, choppy (avoid trend strategies)
- "volatile": Erratic, unpredictable moves (high risk)

Respond in JSON: { "regime": "trending|ranging|volatile", "confidence": 0-100, "reasoning": "brief explanation" }
    `;

    for (const modelName of this.models) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            regime: 'trending' | 'ranging' | 'volatile';
            confidence: number;
            reasoning: string;
          };
          logger.info(
            `🌍 [AI REGIME] ${parsed.regime.toUpperCase()} (${parsed.confidence}%): ${parsed.reasoning}`
          );
          return parsed;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown';
        logger.warn(`⚠️ Regime analysis failed on ${modelName}: ${errMsg.substring(0, 50)}`);
      }
    }

    return { regime: 'trending', confidence: 50, reasoning: 'AI failed - defaulting to trending' };
  }

  async assessRiskParameters(
    baseEntry: number,
    baseATR: number,
    direction: 'LONG' | 'SHORT'
  ): Promise<{ stopLossMultiplier: number; takeProfitMultiplier: number; reasoning: string }> {
    if (!this.genAI) {
      return { stopLossMultiplier: 2, takeProfitMultiplier: 4, reasoning: 'Default 2:1 R:R' };
    }

    const prompt = `
You are a professional risk manager for crypto trading.

Trade Setup:
- Direction: ${direction}
- Entry: ${baseEntry}
- Base ATR: ${baseATR}
- Current Market: Active trading session

Recommend optimal stop-loss and take-profit multipliers based on ATR.
Consider:
- Market volatility
- Direction bias
- Intraday nature (close by EOD)

Typical ranges:
- Stop Loss: 1.5x - 3x ATR
- Take Profit: 3x - 6x ATR (maintain R:R > 1.5)

Respond in JSON: { "stopLossMultiplier": number, "takeProfitMultiplier": number, "reasoning": "brief" }
    `;

    for (const modelName of this.models) {
      try {
        const model = this.genAI.getGenerativeModel({ model: modelName });
        const result = await model.generateContent(prompt);
        const text = (await result.response).text();
        const jsonMatch = text.match(/\{.*\}/s);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            stopLossMultiplier: number;
            takeProfitMultiplier: number;
            reasoning: string;
          };
          logger.info(
            `💰 [AI RISK] SL: ${parsed.stopLossMultiplier}x, TP: ${parsed.takeProfitMultiplier}x - ${parsed.reasoning}`
          );
          return parsed;
        }
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Unknown';
        logger.warn(`⚠️ Risk assessment failed on ${modelName}: ${errMsg.substring(0, 50)}`);
      }
    }

    return {
      stopLossMultiplier: 2,
      takeProfitMultiplier: 4,
      reasoning: 'AI failed - using conservative 2:1',
    };
  }
}

export const aiService = new AIService();

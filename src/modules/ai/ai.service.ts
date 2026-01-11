import { GoogleGenerativeAI } from '@google/generative-ai';
import { Signal } from '../../interface/trading.interface.js';
import dotenv from 'dotenv';
import logger from '../../utils/logger.js';

dotenv.config();

export class AIService {
  private genAI: GoogleGenerativeAI | null = null;
  private models: string[] = [
    'gemini-1.5-flash',
    'gemini-1.5-pro',
    'gemini-2.0-flash-exp',
    'gemini-pro',
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
}

export const aiService = new AIService();

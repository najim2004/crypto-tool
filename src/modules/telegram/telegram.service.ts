import TelegramBot from 'node-telegram-bot-api';
import { isMainThread, parentPort, workerData } from 'worker_threads';
import { Signal } from '../../interface/trading.interface.js';
import dotenv from 'dotenv';
import logger from '../../utils/logger.js';

dotenv.config();

export class TelegramService {
  private bot: TelegramBot | null = null;
  private chatId: string | null = null;

  constructor() {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    this.chatId = process.env.TELEGRAM_CHAT_ID || null;

    // Only initialize bot in main thread
    if (isMainThread && token && token !== 'your_telegram_bot_token_here') {
      this.bot = new TelegramBot(token, { polling: true });
      this.initCommands();
      logger.info('✅ Telegram Bot initialized with command support');
    } else if (!isMainThread) {
      logger.info(`✅ Telegram Service initialized in worker mode (proxying to main)`);
    }
  }

  private initCommands(): void {
    if (!this.bot) return;

    // /start command
    this.bot.onText(/\/start/, (msg: TelegramBot.Message) => {
      const welcomeMsg = `
🚀 *Crypto Signal Generator Bot*

আমি প্রতিদিন 1-3টি high-confidence intraday crypto trading signals প্রদান করি।

*Available Commands:*
/status - বট এবং সিস্টেম স্ট্যাটাস
/today - আজকের signals দেখুন
/help - সাহায্য এবং তথ্য
      `;
      this.bot?.sendMessage(msg.chat.id, welcomeMsg, { parse_mode: 'Markdown' });
    });

    // /status command
    this.bot.onText(/\/status/, (msg: TelegramBot.Message) => {
      const statusMsg = `
📊 *System Status*

✅ Bot: Active
✅ Database: Connected
✅ AI Models: Multi-model fallback ready
⏱️ Polling Interval: 1 minute
🎯 Min Score Threshold: 70/100

*Models:*
• gemini-1.5-flash
• gemini-1.5-pro
• gemini-2.0-flash-exp
• gemini-pro

সিস্টেম স্বাভাবিকভাবে চলছে 🚀
      `;
      this.bot?.sendMessage(msg.chat.id, statusMsg, { parse_mode: 'Markdown' });
    });

    // /today command
    this.bot.onText(/\/today/, async (msg: TelegramBot.Message) => {
      try {
        const SignalModel = (await import('../signal/signal.model.js')).SignalModel;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const signals = await SignalModel.find({
          timestamp: { $gte: today },
        }).sort({ timestamp: -1 });

        if (signals.length === 0) {
          this.bot?.sendMessage(msg.chat.id, '📭 আজকের কোনো signal এখনও generate হয়নি।');
          return;
        }

        let message = `📅 *আজকের Signals (${signals.length})*\n\n`;
        signals.forEach((sig, idx) => {
          message += `${idx + 1}. ${sig.direction} ${sig.symbol}\n`;
          message += `   Entry: ${sig.entryPrice.toFixed(2)}\n`;
          message += `   Score: ${sig.aiScore || 'N/A'}/100\n`;
          message += `   Status: ${sig.status}\n\n`;
        });

        this.bot?.sendMessage(msg.chat.id, message, { parse_mode: 'Markdown' });
      } catch {
        this.bot?.sendMessage(msg.chat.id, "❌ Error fetching today's signals");
      }
    });

    // /help command
    this.bot.onText(/\/help/, (msg: TelegramBot.Message) => {
      const helpMsg = `
ℹ️ *Help & Information*

*এই বট কী করে?*
আমি Binance-এর BTC/USDT market analyze করি এবং technical indicators + AI ব্যবহার করে high-probability trading signals generate করি।

*Strategy:*
• Multi-timeframe: 1H + 15m + 5m
• Indicators: EMA, RSI, MACD, ATR, VWAP
• AI Scoring: Gemini models
• Risk: 2:1 minimum R:R

*Commands:*
/start - Start the bot
/status - System status
/today - Today's signals
/help - This help message

⚠️ *Disclaimer:* Trading is risky. Always use proper risk management.
      `;
      this.bot?.sendMessage(msg.chat.id, helpMsg, { parse_mode: 'Markdown' });
    });

    logger.info('✅ Telegram commands initialized');
  }

  /**
   * Send status update notification
   */
  async sendStatusUpdate(message: string): Promise<void> {
    if (!isMainThread) {
      this.forwardToMain('sendStatusUpdate', [message]);
      return;
    }

    if (!this.bot || !this.chatId) {
      logger.warn('⚠️ Telegram Bot not configured, skipping notification.');
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error sending Telegram status update: ${errMsg}`);
    }
  }

  /**
   * Send early exit warning
   */
  async sendEarlyExitWarning(message: string): Promise<void> {
    if (!isMainThread) {
      this.forwardToMain('sendEarlyExitWarning', [message]);
      return;
    }

    if (!this.bot || !this.chatId) {
      logger.warn('⚠️ Telegram Bot not configured, skipping notification.');
      return;
    }

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error sending Telegram warning: ${errMsg}`);
    }
  }

  /**
   * Send TP hit notification
   */
  async sendTpHitNotification(
    signal: Signal,
    exitPrice: number,
    tpLevel: 'TP1' | 'TP2'
  ): Promise<void> {
    if (!isMainThread) {
      this.forwardToMain('sendTpHitNotification', [signal, exitPrice, tpLevel]);
      return;
    }

    if (!this.bot || !this.chatId) {
      logger.warn('⚠️ Telegram Bot not configured, skipping notification.');
      return;
    }

    const pnlPercent = ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100;
    const emoji = tpLevel === 'TP2' ? '🎉🎉🎉' : '🎉';

    const message = `
${emoji} *${tpLevel} HIT!*
━━━━━━━━━━━━━━━━━━
🚀 *${signal.symbol}* ${signal.direction}

💰 *Entry:* ${signal.entryPrice.toFixed(4)}
🎯 *${tpLevel}:* ${exitPrice.toFixed(4)}
📈 *Profit:* +${pnlPercent.toFixed(2)}%

⏰ *Time:* ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
━━━━━━━━━━━━━━━━━━
${tpLevel === 'TP2' ? '_Final target reached! Excellent trade!_' : '_Partial target reached! Consider trailing stop._'}
    `.trim();

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error sending Telegram TP notification: ${errMsg}`);
    }
  }

  /**
   * Send SL hit notification
   */
  async sendSlHitNotification(signal: Signal, exitPrice: number): Promise<void> {
    if (!isMainThread) {
      this.forwardToMain('sendSlHitNotification', [signal, exitPrice]);
      return;
    }

    if (!this.bot || !this.chatId) {
      logger.warn('⚠️ Telegram Bot not configured, skipping notification.');
      return;
    }

    const pnlPercent = ((exitPrice - signal.entryPrice) / signal.entryPrice) * 100;

    const message = `
🛑 *STOP LOSS HIT*
━━━━━━━━━━━━━━━━━━
📉 *${signal.symbol}* ${signal.direction}

💰 *Entry:* ${signal.entryPrice.toFixed(4)}
🛑 *Stop Loss:* ${exitPrice.toFixed(4)}
📉 *Loss:* ${pnlPercent.toFixed(2)}%

⏰ *Time:* ${new Date().toLocaleString('en-GB', { timeZone: 'UTC' })} UTC
━━━━━━━━━━━━━━━━━━
_Loss contained as planned. Stay disciplined._
    `.trim();

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error sending Telegram SL notification: ${errMsg}`);
    }
  }

  async sendSignal(signal: Signal): Promise<void> {
    if (!isMainThread) {
      this.forwardToMain('sendSignal', [signal]);
      return;
    }

    if (!this.bot || !this.chatId) {
      logger.warn('⚠️ Telegram Bot not configured, skipping notification.');
      logger.info(`Offered Signal: ${JSON.stringify(signal)}`);
      return;
    }

    // Dynamic precision helper: if price < 1, use 6 decimals, else 2 or 4 based on value
    const formatPrice = (price: number): string => {
      if (price < 0.001) return price.toFixed(8);
      if (price < 1) return price.toFixed(6);
      if (price < 10) return price.toFixed(4);
      return price.toFixed(2);
    };

    const entryArea = signal.entryRange
      ? `${formatPrice(signal.entryRange.min)} - ${formatPrice(signal.entryRange.max)}`
      : formatPrice(signal.entryPrice);

    const timeStr = new Intl.DateTimeFormat('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
      timeZone: 'UTC',
    }).format(signal.timestamp);

    const typeTag = signal.quality === 'PREMIUM' ? '🔥 *PREMIUM SIGNAL*' : '✅ *STANDARD SIGNAL*';

    const message = `
${typeTag}
🚀 *${signal.direction}: ${signal.symbol}*
━━━━━━━━━━━━━━━━━━
📥 *Entry Zone:* ${entryArea}
🎯 *TP 1:* ${signal.takeProfits?.tp1 ? formatPrice(signal.takeProfits.tp1) : 'N/A'}
🎯 *TP 2:* ${signal.takeProfits?.tp2 ? formatPrice(signal.takeProfits.tp2) : 'N/A'}
🛑 *Stop Loss:* ${formatPrice(signal.stopLoss)}
📊 *AI Confidence:* ${signal.aiScore ?? 'N/A'}/100
⏰ *Time:* ${timeStr} UTC

📝 *Market Context:*
${signal.aiReason ?? 'No reasoning provided.'}
━━━━━━━━━━━━━━━━━━
_Auto-generated by Antigravity Trading System_
    `;

    try {
      await this.bot.sendMessage(this.chatId, message, { parse_mode: 'Markdown' });
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error sending Telegram message: ${errMsg}`);
    }
  }

  /**
   * Helper to forward messages to main process
   */
  private forwardToMain(method: string, args: any[]): void {
    if (!parentPort) return;

    parentPort.postMessage({
      type: 'TELEGRAM_FORWARD',
      workerId: (workerData as any).workerId,
      data: {
        method,
        args,
      },
      timestamp: Date.now(),
    });
  }
}

export const telegramService = new TelegramService();

# Remaining Tasks (vs plan.txt)

Here is a breakdown of what has been implemented and what is still missing compared to the original `plan.txt`.

## ✅ Completed Code / Implemented
*   **Binance Data API**: Fetching Klines (1h, 15m, 5m) and Price.
*   **Core Strategy Logic**:
    *   1H Trend Direction (EMA 50 + RSI).
    *   15m Momentum (MACD, VWAP, RSI).
    *   5m Entry Trigger (EMA 20, VWAP, MACD).
    *   Risk Management (2:1 R:R).
*   **AI Integration**: Gemini API integration for scoring and reasoning.
*   **Telegram Bot**: Sending signals and handling commands (`/start`, `/status`, `/today`).
*   **Data Logging**: Storing signals in MongoDB.
*   **Basic Polling Loop**: Running every 1 minute.

## 🚧 Missing / To Be Implemented

### 1. Market Filters (Crucial for Accuracy)
*   **[ ] Session Time Filter**: The plan specifies trading only during **London/New York overlap (13:00–17:00 UTC)**. Currently, the bot evaluates signals 24/7.
*   **[ ] Trend Strength (ADX) Filter**: The plan mentions using **ADX (Average Directional Index)** on 1H (ADX > 25) to confirm a strong trend. Currently, only EMA/RSI is used.
*   **[ ] Volume Confirmation**: The plan requires the 5m breakout candle to have **volume > 2x average volume**. This check is missing.

### 2. System Improvements
*   **[ ] Polling Frequency**: Currently set to **60 seconds**. The plan suggests **5-10 seconds** to catch 5m candle closes promptly and avoid late entries.
*   **[ ] Dynamic Symbol Support**: Currently hardcoded to `'BTCUSDT'`. The plan implies 1-3 symbols, allowing configuration would be better.

### 3. Trade Management
*   **[ ] End-of-Day (EOD) Force Close**: The plan requires specifically "closing" all open trades at the end of the session to avoid overnight risk. Currently, the bot just sends a summary but doesn't explicitly mark open trades as closed/expired in the DB.

## Recommended Next Steps
1.  **Implement ADX & Volume MA**: Add these to `indicator.service.ts` to fully meet the plan's technical requirements.
2.  **Add Session Filter**: Restrict the `evaluate()` method to only run within the specific UTC window.
3.  **Optimize Polling**: Reduce interval to 10s for better responsiveness.

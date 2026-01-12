# Crypto Signal Generator - System Flow

This document details the operational flow of the trading bot.

```mermaid
graph TD
    Start([Start Application]) --> Init[CoreLoader.init]
    Init --> PollLoop{Polling Loop <br/> Every 10s}
    
    PollLoop -->|Trigger| SessionCheck{Session Check <br/> 13:00 - 17:00 UTC?}
    
    SessionCheck -- No --> Wait[Wait for next cycle] --> PollLoop
    SessionCheck -- Yes --> FetchData[BinanceService <br/> Fetch Klines: 1h, 15m, 5m]
    
    FetchData --> CalcInd[IndicatorService <br/> Compute EMA, RSI, MACD, ADX, VolSMA]
    
    CalcInd --> StratEval[StrategyService.evaluate]
    
    StratEval --> TrendCheck{1. Trend Check <br/> 1H EMA/RSI Direction <br/> AND <br/> 1H ADX > 25?}
    
    TrendCheck -- No / Range --> Wait
    TrendCheck -- Yes (UP/DOWN) --> MomCheck{2. Momentum Check <br/> 15m VWAP/MACD/RSI <br/> confirms direction?}
    
    MomCheck -- No --> Wait
    MomCheck -- Yes --> TriggerCheck{3. Entry Trigger <br/> 5m Breakout <br/> AND <br/> Vol > 2x Avg?}
    
    TriggerCheck -- No --> Wait
    TriggerCheck -- Yes --> SignalFound[Signal Generated]
    
    SignalFound --> AIScore[AiService.scoreSignal <br/> Gemini AI Evaluation]
    
    AIScore --> ScoreCheck{AI Score >= 70?}
    
    ScoreCheck -- No --> LogDiscard[Log: Signal Discarded] --> Wait
    ScoreCheck -- Yes --> SaveDB[(Save to MongoDB)]
    
    SaveDB --> SendTele[TelegramService <br/> Send Notification]
    SendTele --> Wait

```

## Key Components

1.  **CoreLoader**: The engine that runs the loop.
2.  **BinanceService**: Fetches raw market data (Oh, High, Low, Close, Volume).
3.  **IndicatorService**: Converts raw data into technical indicators.
4.  **StrategyService**: Applies the trading rules (Filters, Triggers).
5.  **AiService**: Validates the technical setup using LLM analysis.
6.  **TelegramService**: Delivers the final validated signal to the user.

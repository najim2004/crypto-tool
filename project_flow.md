# System Flowchart & Logic Documentation

This document describes the end-to-end flow of the **AI-Powered Crypto Trading Tool**. It details how the system polls for data, evaluates strategies, validates with AI, and sends signals.

## 🔄 High-Level Flowchart

```mermaid
graph TD
    A[Start: Loader Service] -->|Every 1 Min| B{Is Polling Active?}
    B -- Yes --> C[Skip Cycle]
    B -- No --> D[Fetch All Symbols]
    
    subgraph "Strategy Evaluation (Per Symbol)"
        D --> E[Fetch Klines: 4h, 1h, 15m, 5m]
        E --> F[Calculate Indicators (RSI, ADX, VWAP, MACD, etc)]
        F --> G[Detect Market Regime]
        
        G -->|CHOPPY| H[⛔ Filter: Discard]
        G -->|TRENDING / RANGING| I{Check Tier: PRIME}
        
        I -- Pass --> J[🔥 Generate PRIME Signal]
        I -- Fail --> K{Check Tier: STANDARD}
        
        K -- Pass --> L[✅ Generate STANDARD Signal]
        K -- Fail --> M[⛔ Discard Signal]
    end

    J & L --> N{Cooldown Check}
    N -- Active --> O[Skip (Cooldown)]
    N -- Inactive --> P[🤖 AI Validation]

    P -->|Score < 70| Q[⚠️ Discard (Low AI Score)]
    P -->|Score >= 70| R[🚀 Final Signal]

    R --> S[💾 Save to Database]
    S --> T[📲 Send to Telegram]
```

---

## 🧠 Detailed Logic Breakdown

### 1. **Core Loader (`loader.ts`)**
*   **Trigger:** Runs every **1 minute**.
*   **Concurrency:** Ensures only one polling cycle runs at a time.
*   **Cooldown:** Checks if a signal was sent for the same coin in the last **4 hours** (to prevent spam).

### 2. **Strategy Evaluation (`strategy.service.ts`)**
This is the brain of the operation. It processes each symbol (e.g., BTCUSDT) through a funnel of filters.

#### **Step A: Data Fetching**
*   Fetches 100 candles for: `4h` (Macro), `1h` (Trend), `15m` (Confirmation), `5m` (Entry).

#### **Step B: Market Regime Detection**
*   **Input:** 4H Candles + 1H ADX/EMA.
*   **Logic:**
    *   **Trend:** Price > EMA50 (Up) or Price < EMA50 (Down).
    *   **Strength:** ADX > 20.
    *   **Choppy:** If ADX < 20 and SMA/EMA alignment is messy.
*   **Action:** If `CHOPPY`, the signal is immediately **discarded**.

#### **Step C: Signal Tier Check (Dual-Pass)**
The system tries to generate a **PRIME** signal first. If that fails, it tries for a **STANDARD** signal.

| Feature | **🔥 PRIME (Strict)** | **✅ STANDARD (Relaxed)** |
| :--- | :--- | :--- |
| **Trend Strength** | ADX > **25** | ADX > **20** |
| **RSI Range** | Stricter (e.g., 50-65 for Long) | Wider (e.g., 40-70 for Long) |
| **Volume** | **2.0x** vs SMA | **1.0x** vs SMA |
| **Order Flow** | **Must have Positive Delta** | Ignored |
| **Macro Trend** | **Must align with 4H** | Ignored |

#### **Step D: Quantitative Order Flow**
*   **Delta:** Calculates `Buying Pressure` (Taker Buy Vol - Sell Vol).
*   **Whale Detector:** Checks `Trade Intensity` (High Vol + Low Count = Whale).
*   **Usage:** PRIME signals **require** Order Flow confirmation (e.g., Long Signal + Positive Delta).

### 3. **AI Validation (`ai.service.ts`)**
*   **Input:** The raw signal + Technical Context (RSI values, Trend status, Regime, Delta).
*   **Process:** Sends a prompt to Google Gemini AI acting as a "Senior Crypto Analyst".
*   **Output:** A score (0-100) and a reason.
*   **Filter:** Only signals with **Score ≥ 70** proceed.

### 4. **Execution (`telegram.service.ts`)**
*   **Action:** content formats a message with emojis, price levels, and dynamic decimals.
*   **Result:** You receive a notification on Telegram.

---

## ✅ Flow Summary (True/False Path)
1.  **Is Market Choppy?**
    *   **True** ➔ 🛑 STOP
    *   **False** ➔ Continue
2.  **Is Signal PRIME Quality?**
    *   **True** ➔ ✅ Mark as PRIME
    *   **False** ➔ Check STANDARD Quality
3.  **Is Signal STANDARD Quality?**
    *   **True** ➔ ✅ Mark as STANDARD
    *   **False** ➔ 🛑 STOP
4.  **Is Cooldown Active?**
    *   **True** ➔ 🛑 STOP
    *   **False** ➔ Continue
5.  **Does AI Score >= 70?**
    *   **True** ➔ 🚀 **SEND SIGNAL**
    *   **False** ➔ 🛑 STOP

/**
 * Worker Message Protocol
 * Type-safe message interfaces for worker communication
 */

import { Signal } from '../interface/trading.interface.js';

export interface WorkerMessage {
  type:
    | 'NEW_SIGNAL'
    | 'RISK_WARNING'
    | 'MONITORING_STATUS'
    | 'WORKER_READY'
    | 'ERROR'
    | 'ERROR'
    | 'TELEGRAM_FORWARD'
    | 'HEARTBEAT';
  workerId?: number;
  data: any;
  timestamp: number;
}

export interface MainProcessMessage {
  type: 'SHUTDOWN' | 'PAUSE' | 'RESUME' | 'HEALTH_CHECK';
  data?: any;
}

export interface NewSignalMessage extends WorkerMessage {
  type: 'NEW_SIGNAL';
  data: Signal;
}

export interface RiskWarningMessage extends WorkerMessage {
  type: 'RISK_WARNING';
  data: {
    signal: Signal;
    message: string;
    riskLevel: 'HIGH' | 'MEDIUM';
  };
}

export interface MonitoringStatusMessage extends WorkerMessage {
  type: 'MONITORING_STATUS';
  data: {
    openSignalsCount: number;
    lastCheck: Date;
  };
}

export interface WorkerReadyMessage extends WorkerMessage {
  type: 'WORKER_READY';
  data: {
    symbols?: string[];
    workerType: 'SYMBOL' | 'MONITORING';
  };
}

export interface WorkerErrorMessage extends WorkerMessage {
  type: 'ERROR';
  data: {
    error: string;
    stack?: string;
  };
}

export interface TelegramForwardMessage extends WorkerMessage {
  type: 'TELEGRAM_FORWARD';
  data: {
    method:
      | 'sendSignal'
      | 'sendEarlyExitWarning'
      | 'sendStatusUpdate'
      | 'sendTpHitNotification'
      | 'sendSlHitNotification';
    args: any[];
  };
}

export interface HeartbeatMessage extends WorkerMessage {
  type: 'HEARTBEAT';
  data: {
    workerId: number;
    status: 'ALIVE';
  };
}

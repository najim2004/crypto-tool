/**
 * Database Connection Utility
 * Shared MongoDB connection for workers and main process
 */

import mongoose from 'mongoose';
import logger from './logger.js';

let isConnected = false;

export async function connectDB(): Promise<void> {
  // Check if mongoose is already connected (from server.ts)
  if (mongoose.connection.readyState === 1) {
    isConnected = true;
    logger.info('✅ Using existing MongoDB connection');
    return;
  }

  // Try both environment variable names
  const uri = process.env.MONGODB_URI || process.env.DATABASE_URL;

  if (!uri) {
    logger.error('❌ Database URI not found (checked MONGODB_URI and DATABASE_URL)');
    throw new Error('Database URI is required (MONGODB_URI or DATABASE_URL)');
  }

  try {
    await mongoose.connect(uri, {
      maxPoolSize: 10,
      minPoolSize: 2,
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    isConnected = true;
    logger.info('✅ MongoDB connected');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ MongoDB connection failed: ${msg}`);
    throw error;
  }
}

export async function disconnectDB(): Promise<void> {
  if (!isConnected) {
    return;
  }

  try {
    await mongoose.disconnect();
    isConnected = false;
    logger.info('✅ MongoDB disconnected');
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logger.error(`❌ MongoDB disconnection failed: ${msg}`);
  }
}

export function getConnectionStatus(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}

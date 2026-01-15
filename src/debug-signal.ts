import dotenv from 'dotenv';
dotenv.config();

import { strategyService } from './modules/strategy/strategy.service.js';
import logger from './utils/logger.js';

async function main() {
  logger.info('============== DEBUG RUN START ==============');
  try {
    const signals = await strategyService.evaluateAll();
    logger.info('============== DEBUG RUN COMPLETE ==============');
    logger.info(`Found ${signals.length} signals`);
    if (signals.length > 0) {
      console.log('Signals found:', JSON.stringify(signals, null, 2));
    } else {
      console.log('No signals valid under current criteria.');
    }
  } catch (error) {
    console.error('Error running strategy:', error);
  }
}

main();

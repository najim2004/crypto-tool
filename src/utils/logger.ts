import { pino } from 'pino';
import config from '../config/index.js';

const logger = pino(
  config.node_env === 'development'
    ? {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
          },
        },
      }
    : {
        level: 'info',
      }
);

export default logger;

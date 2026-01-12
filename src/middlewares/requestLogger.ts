import pinoHttp from 'pino-http';
import logger from '../utils/logger.js';
import config from '../config/index.js';
import { IncomingMessage, ServerResponse } from 'http';

const pinoHttpMiddleware = pinoHttp({
  logger,
  ...(config.node_env === 'development' && {
    transport: {
      target: 'pino-pretty',
      options: {
        colorize: true,
        levelFirst: true,
        translateTime: 'SYS:standard',
      },
    },
  }),
  customSuccessMessage: function (req: IncomingMessage, res: ServerResponse) {
    if (res.statusCode === 404) {
      return 'Resource not found';
    }
    return `${req.method} ${req.url} completed`;
  },
  customErrorMessage: function (req: IncomingMessage) {
    return `Request failed: ${req.method} ${req.url}`;
  },
});

export default pinoHttpMiddleware;

import mongoose from 'mongoose';
import app from './app';
import config from './config/index';
import logger from './utils/logger';
import globalErrorHandler from './middlewares/globalErrorHandler';
import notFound from './middlewares/notFound';

async function bootstrap(): Promise<void> {
  try {
    if (!config.database_url) {
      logger.error('FATAL: Database URL is not defined in .env file.');
      process.exit(1);
    }

    // Connect to DB
    await mongoose.connect(config.database_url);
    logger.info('️✔️ Database connected successfully');

    // Add final middlewares
    app.use(globalErrorHandler);
    app.use(notFound);

    // Start server
    app.listen(config.port, () => {
      logger.info(`✔️ Server is listening on port ${config.port}`);

      // Initialize Trading Core
      import('./core/loader.js').then(({ CoreLoader }) => {
        CoreLoader.init();
      });
    });
  } catch (err: unknown) {
    if (err instanceof Error) {
      logger.error(`❌ Failed to bootstrap application: ${err.message}`);
    } else {
      logger.error('❌ Failed to bootstrap application with an unknown error.');
    }
    process.exit(1);
  }
}

bootstrap();

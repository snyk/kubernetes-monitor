import * as bunyan from 'bunyan';
import { config } from './config';

try {
  // Validate if LOG_LEVEL has valid bunyan logging level
  config.LOGGING.level = bunyan.resolveLevel(
    process.env.LOG_LEVEL || config.LOGGING.level,
  );
} catch (e) {
  console.error(
    `Log level "${process.env.LOG_LEVEL}" is not valid logging level. Falling back to "INFO"`,
  );
}

const logger: bunyan = bunyan.createLogger({
  name: config.LOGGING.name,
  level: config.LOGGING.level,
  serializers: {
    req: bunyan.stdSerializers.req,
    res: bunyan.stdSerializers.res,
    err: bunyan.stdSerializers.err,
    error: bunyan.stdSerializers.err,
  },
});

if (process.env.NODE_ENV === 'test') {
  logger.level(bunyan.FATAL + 1);
}

export { logger };

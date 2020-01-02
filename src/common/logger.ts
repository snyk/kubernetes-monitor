import * as bunyan from 'bunyan';
import config = require('./config');

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

export = logger;

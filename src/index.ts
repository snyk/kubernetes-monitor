import * as SourceMapSupport from 'source-map-support';
import * as app from './app';
import logger = require('./common/logger');

process.on('uncaughtException', (err) => {
  try {
    logger.error({err}, 'UNCAUGHT EXCEPTION!');
  } catch (ignore) {
    console.log('UNCAUGHT EXCEPTION!', err);
  } finally {
    process.exit(1);
  }
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error({reason, promise}, 'unhandled rejection');
});

SourceMapSupport.install();
app.monitor();

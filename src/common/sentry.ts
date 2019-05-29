import Sentry = require('@sentry/node');
import config = require('./config');

Sentry.init({
  dsn: config.SENTRY_DSN,
  maxBreadcrumbs: 20,
});

export = Sentry;

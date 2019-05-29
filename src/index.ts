import * as SourceMapSupport from 'source-map-support';
import * as app from './app';
import * as config from './common/config';
import { logger } from './common/logger';

SourceMapSupport.install();
config.setMonitoringConfig();
app.monitor(config, logger);

import * as SourceMapSupport from 'source-map-support';
import * as app from './app';
import * as config from './common/config';

SourceMapSupport.install();
app.monitor(config);

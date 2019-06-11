import * as SourceMapSupport from 'source-map-support';
import * as app from './app';

SourceMapSupport.install();
app.monitor();

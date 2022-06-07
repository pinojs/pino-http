import { expectType } from 'tsd';

import pino from 'pino';
import pinoHttp, { HttpLogger } from '../src';
import { pinoHttp as pinoHttpNamed } from '../src';
import * as pinoHttpStar from '../src';
import pinoHttpCjsImport = require ('../src');
const pinoHttpCjs = require('.');
const { pinoHttp: pinoHttpCjsNamed } = require('.')

const logger = pino();

expectType<HttpLogger>(pinoHttp({ logger }));
expectType<HttpLogger>(pinoHttpNamed());
expectType<HttpLogger>(pinoHttpStar.default());
expectType<HttpLogger>(pinoHttpStar.pinoHttp());
expectType<HttpLogger>(pinoHttpCjsImport.default());
expectType<HttpLogger>(pinoHttpCjsImport.pinoHttp());
expectType<any>(pinoHttpCjs());
expectType<any>(pinoHttpCjsNamed());

/// <reference path="../src/index.d.ts"/>

import { expectType } from 'tsd';

import pino from 'pino';
import pinoHttp, { HttpLogger } from '..';
import { pinoHttp as pinoHttpNamed } from '..';
import * as pinoHttpStar from '..';
// @ts-ignore
import pinoHttpCjsImport = require('..');
const pinoHttpCjs = require('..');
const { pinoHttp: pinoHttpCjsNamed } = require('..')

const logger = pino();

expectType<HttpLogger>(pinoHttp({ logger }));
expectType<HttpLogger>(pinoHttpNamed());
expectType<HttpLogger>(pinoHttpStar.default());
expectType<HttpLogger>(pinoHttpStar.pinoHttp());
expectType<HttpLogger>(pinoHttpCjsImport.default());
expectType<HttpLogger>(pinoHttpCjsImport.pinoHttp());
expectType<any>(pinoHttpCjs());
expectType<any>(pinoHttpCjsNamed());

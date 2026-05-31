import { expectNotAssignable, expectType } from 'tsd';

import { IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';
import pinoHttp, { GenReqId, HttpLogger } from '.';
import { pinoHttp as pinoHttpNamed } from '.';
import * as pinoHttpStar from '.';
import pinoHttpCjsImport = require ('.');
const pinoHttpCjs = require('.');
const { pinoHttp: pinoHttpCjsNamed } = require('.');

const logger = pino();

expectType<HttpLogger>(pinoHttp({ logger }));
expectType<HttpLogger>(pinoHttp({
  customSuccessMessage(req, res, responseTime) {
    return `${responseTime}`
  }
}));
expectType<HttpLogger>(pinoHttpNamed());
expectType<HttpLogger>(pinoHttpStar.default());
expectType<HttpLogger>(pinoHttpStar.pinoHttp());
expectType<HttpLogger>(pinoHttpCjsImport.default());
expectType<HttpLogger>(pinoHttpCjsImport.pinoHttp());
expectType<any>(pinoHttpCjs());
expectType<any>(pinoHttpCjsNamed());

expectNotAssignable<GenReqId>((_req: IncomingMessage, _res: ServerResponse) => Buffer.allocUnsafe(16));
expectNotAssignable<GenReqId>((_req: IncomingMessage, _res: ServerResponse) => ({ id: 'nope' }));

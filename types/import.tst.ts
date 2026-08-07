import { expect } from 'tstyche';
import { IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';
import pinoHttp, { GenReqId, HttpLogger } from '.';
import { pinoHttp as pinoHttpNamed } from '.';
import * as pinoHttpStar from '.';
import pinoHttpCjsImport = require('.');
const pinoHttpCjs = require('.');
const { pinoHttp: pinoHttpCjsNamed } = require('.');

const logger = pino();

expect(pinoHttp({ logger })).type.toBe<HttpLogger>();
expect(
  pinoHttp({
    customSuccessMessage(req, res, responseTime) {
      return `${responseTime}`;
    }
  })
).type.toBe<HttpLogger>();
expect(pinoHttpNamed()).type.toBe<HttpLogger>();
expect(pinoHttpStar.default()).type.toBe<HttpLogger>();
expect(pinoHttpStar.pinoHttp()).type.toBe<HttpLogger>();
expect(pinoHttpCjsImport.default()).type.toBe<HttpLogger>();
expect(pinoHttpCjsImport.pinoHttp()).type.toBe<HttpLogger>();
expect(pinoHttpCjs()).type.toBe<any>();
expect(pinoHttpCjsNamed()).type.toBe<any>();

expect<GenReqId>().type.not.toBeAssignableTo<
  (_req: IncomingMessage, _res: ServerResponse) => Buffer
>();
expect<GenReqId>().type.not.toBeAssignableTo<
  (_req: IncomingMessage, _res: ServerResponse) => { id: string }
>();

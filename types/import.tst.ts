import { expect } from 'tstyche';

import pino from 'pino';
import pinoHttp, { HttpLogger } from '..';
import { pinoHttp as pinoHttpNamed } from '..';
import * as pinoHttpStar from '..';
import pinoHttpCjsImport = require('..');
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

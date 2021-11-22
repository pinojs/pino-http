
/// <reference path="./index.d.ts"/>

import { Writable } from 'stream';
import { IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';
import pinoHttp from './';

const logger = pino();

pinoHttp({ logger });
pinoHttp({ logger }).logger = logger;
pinoHttp({ genReqId: (req: IncomingMessage) => req.statusCode || 200 });
pinoHttp({ genReqId: (req: IncomingMessage) => 'foo' });
pinoHttp({ genReqId: (req: IncomingMessage) => Buffer.allocUnsafe(16) });
pinoHttp({ useLevel: 'error' });
pinoHttp({ prettyPrint: true }); // deprecated but still present in pino.
pinoHttp({ transport: { target: 'pino-pretty', options: { colorize: true } } });
pinoHttp({ autoLogging: false });
pinoHttp({ autoLogging: { ignore: (req: IncomingMessage) => req.headers['user-agent'] === 'ELB-HealthChecker/2.0' } });
pinoHttp({ autoLogging: { ignorePaths: ['/health'] } });
pinoHttp({ autoLogging: { ignorePaths: [/\/health/] } });
pinoHttp({ autoLogging: { ignorePaths: ['/health'], getPath: (req: IncomingMessage) => req.url } });
pinoHttp({ customSuccessMessage: (req: ServerResponse) => 'Success' });
pinoHttp({ customErrorMessage: (error: Error, res: ServerResponse) => `Error - ${error}` });
pinoHttp({ customAttributeKeys: { req: 'req' } });
pinoHttp({ customAttributeKeys: { res: 'res' } });
pinoHttp({ customAttributeKeys: { err: 'err' } });
pinoHttp({ customAttributeKeys: { responseTime: 'responseTime' } });
pinoHttp({ customAttributeKeys: { req: 'req', res: 'res', err: 'err', responseTime: 'responseTime' } });
pinoHttp({ customLogLevel: (res: ServerResponse, error: Error) => 'info' });
pinoHttp({ reqCustomProps: (req: IncomingMessage, res: ServerResponse) => ({ key1: 'value1', 'x-key-2': 'value2' }) });
pinoHttp({ wrapSerializers: false });
pinoHttp(new Writable());
pinoHttp({ quietReqLogger: true, customAttributeKeys: { reqId: 'reqId' }});

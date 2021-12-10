
/// <reference path="index.d.ts"/>

import { Writable } from 'stream';
import { IncomingMessage, ServerResponse } from 'http';
import { Socket } from 'net';
import pino from 'pino';
import pinoHttp, { HttpLogger, ReqId, Options, GenReqId, AutoLoggingOptions, CustomAttributeKeys, StdSerializers, startTime } from '.';
import { RequestListener } from 'http';

const logger = pino();

pinoHttp();
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

const rand = () => {
  let rtn = true;
  if (Math.random() < 0.5) rtn = false;
  return rtn;
}

const canBeUndefined = <T>(input: T) => {
  if (rand()) return input;
  return undefined;
}

const rtnBool = () => {
  let rtn = true;
  if (rand()) rtn = false;
  return rtn;
}

const rtnLevel = () => {
  let rtn: pino.LevelWithSilent = 'debug';
  if (rand()) {
    rtn = 'error';
  } else if (rand()) {
    rtn = 'fatal';
  } else if (rand()) {
    rtn = 'info';
  } else if (rand()) {
    rtn = 'trace';
  } else if (rand()) {
    rtn = 'warn';
  } else if (rand()) {
    rtn = 'silent';
  }
  return rtn;
}

const genReqId: GenReqId = () => {
  let rtn: ReqId = 123;
  if (rand()){
    rtn = 'str';
  } else {
    rtn = ({} as object);
  }
  return rtn;
}

const autoLoggingOptions = (() => {
  let rtn: AutoLoggingOptions | boolean = true;
  if (rand()) {
    rtn = {
      ignore: canBeUndefined(() => true),
      ignorePaths: canBeUndefined(['str', /regex/, new RegExp('regex', 'g')]),
      getPath: canBeUndefined(() => '/path'),
    };
  } else if (rand()) {
    rtn = false;
  }
  return rtn;
})();

const customAttributeKeys: CustomAttributeKeys = {
  req: canBeUndefined('req'),
  res: canBeUndefined('res'),
  err: canBeUndefined('err'),
  reqId: canBeUndefined('reqId'),
  responseTime: canBeUndefined('responseTime'),
}

const options: Options = {
  logger: canBeUndefined(logger),
  genReqId: canBeUndefined(genReqId),
  useLevel: canBeUndefined(rtnLevel()),
  stream: canBeUndefined({ write: (msg: string) => { return } }),
  autoLogging: canBeUndefined(autoLoggingOptions),
  customLogLevel: canBeUndefined((res: ServerResponse, error: Error) => rtnLevel()),
  customReceivedMessage: canBeUndefined((req, res) => {
    res.setHeader('x-custom-header-123', 'custom-header-value');
    return `Received HTTP ${req.httpVersion} ${req.method}`;
  }),
  customSuccessMessage: canBeUndefined((res: ServerResponse) => 'successMessage'),
  customErrorMessage: canBeUndefined((error: Error, res: ServerResponse) => 'errorMessage'),
  customAttributeKeys: canBeUndefined(customAttributeKeys),
  wrapSerializers: canBeUndefined(rtnBool()),
  reqCustomProps: canBeUndefined((req: IncomingMessage, res: ServerResponse) => ({} as object)),
  quietReqLogger: canBeUndefined(rtnBool()),
}

// can't pass 'useLevel' and 'customLogLevel' together
delete options.customLogLevel;
const ph: HttpLogger = pinoHttp(options);

const stdSerializers: StdSerializers = {
  err: {
    type: 'type',
    message: 'message',
    stack: 'stack',
    raw: new Error(),
    'str': {},
    123: {},
  },
  req: {
    id: canBeUndefined('id'),
    method: 'GET',
    url: 'http://0.0.0.0',
    headers: { header: 'header' },
    remoteAddress: '0.0.0.0:80',
    remotePort: 80,
    raw: new IncomingMessage(new Socket()),
  },
  res: {
    statusCode: 200,
    headers: { header: 'header' },
    raw: new ServerResponse(new IncomingMessage(new Socket())),
  },
};

const httpServerListener: RequestListener = (request, response) => {
  // req.log and req.id should be available
  request.log.info(`Request received with request ID ${request.id}`);
  // res[startTime] should be available
  response[startTime] = Date.now();
  response.end("Hello world");
};

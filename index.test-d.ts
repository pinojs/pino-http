
/// <reference path="index.d.ts"/>

import { IncomingMessage, RequestListener, ServerResponse } from 'http';
import { Socket } from 'net';
import pino from 'pino';
import { Writable } from 'stream';
import { err, req, res } from 'pino-std-serializers';
import pinoHttp, { AutoLoggingOptions, CustomAttributeKeys, GenReqId, HttpLogger, Options, ReqId, startTime, StdSerializers, StdSerializedResults } from '.';

const logger = pino();

pinoHttp();
pinoHttp({ logger });
pinoHttp({ logger }).logger = logger;
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => req.statusCode || 200 });
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => res.statusCode || 200 });
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => 'foo' });
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => Buffer.allocUnsafe(16) });
pinoHttp({ useLevel: 'error' });
pinoHttp({ transport: { target: 'pino-pretty', options: { colorize: true } } });
pinoHttp({ autoLogging: false });
pinoHttp({ autoLogging: { ignore: (req: IncomingMessage) => req.headers['user-agent'] === 'ELB-HealthChecker/2.0' } });
pinoHttp({ customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => 'Success' });
pinoHttp({ customErrorMessage: (req: IncomingMessage, res: ServerResponse, error: Error) => `Error - ${error}` });
pinoHttp({ customAttributeKeys: { req: 'req' } });
pinoHttp({ customAttributeKeys: { res: 'res' } });
pinoHttp({ customAttributeKeys: { err: 'err' } });
pinoHttp({ customAttributeKeys: { responseTime: 'responseTime' } });
pinoHttp({ customAttributeKeys: { req: 'req', res: 'res', err: 'err', responseTime: 'responseTime' } });
pinoHttp({ customLogLevel: (req: IncomingMessage, res: ServerResponse, error: Error) => 'info' });
pinoHttp({ customProps: (req: IncomingMessage, res: ServerResponse) => ({ key1: 'value1', 'x-key-2': 'value2' }) });
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
  customLogLevel: canBeUndefined((req: IncomingMessage, res: ServerResponse, error: Error) => rtnLevel()),
  customReceivedMessage: canBeUndefined((req, res) => {
    res.setHeader('x-custom-header-123', 'custom-header-value');
    return `Received HTTP ${req.httpVersion} ${req.method}`;
  }),
  customSuccessMessage: canBeUndefined((req: IncomingMessage, res: ServerResponse) => 'successMessage'),
  customErrorMessage: canBeUndefined((req: IncomingMessage, res: ServerResponse, error: Error) => 'errorMessage'),
  customAttributeKeys: canBeUndefined(customAttributeKeys),
  wrapSerializers: canBeUndefined(rtnBool()),
  customProps: canBeUndefined((req: IncomingMessage, res: ServerResponse) => ({} as object)),
  quietReqLogger: canBeUndefined(rtnBool()),
}

// can't pass 'useLevel' and 'customLogLevel' together
delete options.customLogLevel;
const ph: HttpLogger = pinoHttp(options);

const stdSerializers: StdSerializers = {
    err: err,
    req: req,
    res: res
}

const stdSerializedResults: StdSerializedResults = {
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
  request.allLogs[0].info("Request Received");
  // res[startTime] should be available
  response[startTime] = Date.now();
  response.end("Hello world");
};


/// <reference path="index.d.ts"/>

import { IncomingMessage, RequestListener, ServerResponse } from 'http';
import { Socket } from 'net';
import pino from 'pino';
import { Writable } from 'stream';
import { err, req, res } from 'pino-std-serializers';
import pinoHttp, { AutoLoggingOptions, CustomAttributeKeys, GenReqId, HttpLogger, Options, ReqId, startTime, StdSerializers, StdSerializedResults } from '.';

interface CustomRequest extends IncomingMessage {
  context: number;
}

interface CustomResponse extends ServerResponse {
  context: number;
}

const logger = pino();

pinoHttp();
pinoHttp({ logger });
pinoHttp({ logger }).logger = logger;
pinoHttp<CustomRequest, CustomResponse>({ logger });

// #genReqId
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => req.statusCode || 200 });
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => res.statusCode || 200 });
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => 'foo' });
pinoHttp({ genReqId: (req: IncomingMessage, res: ServerResponse) => Buffer.allocUnsafe(16) });
pinoHttp<CustomRequest, CustomResponse>({ genReqId: (req: CustomRequest, res: CustomResponse) => Buffer.allocUnsafe(16) });

// #useLevel
pinoHttp({ useLevel: 'error' });

// #transport
pinoHttp({ transport: { target: 'pino-pretty', options: { colorize: true } } });

// #autologging
pinoHttp({ autoLogging: false });
pinoHttp({ autoLogging: { ignore: (req: IncomingMessage) => req.headers['user-agent'] === 'ELB-HealthChecker/2.0' } });
pinoHttp<CustomRequest>({ autoLogging: { ignore: (req: CustomRequest) => req.headers['user-agent'] === 'ELB-HealthChecker/2.0' } });

// #customSuccessMessage
pinoHttp({ customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => 'Success' });
pinoHttp<CustomRequest, CustomResponse>({ customSuccessMessage: (req: CustomRequest, res: CustomResponse) => 'Success' });

// #customErrorMessage
pinoHttp({ customErrorMessage: (req: IncomingMessage, res: ServerResponse, error: Error) => `Error - ${error}` });
pinoHttp<CustomRequest, CustomResponse>({ customErrorMessage: (req: CustomRequest, res: CustomResponse, error: Error) => `Error - ${error}` });

// #customAttributeKeys
pinoHttp({ customAttributeKeys: { req: 'req' } });
pinoHttp({ customAttributeKeys: { res: 'res' } });
pinoHttp({ customAttributeKeys: { err: 'err' } });
pinoHttp({ customAttributeKeys: { responseTime: 'responseTime' } });
pinoHttp({ customAttributeKeys: { req: 'req', res: 'res', err: 'err', responseTime: 'responseTime' } });

// #customLogLevel
pinoHttp({ customLogLevel: (req: IncomingMessage, res: ServerResponse, error: Error | undefined) => error ? 'error' : 'info' });
pinoHttp<CustomRequest, CustomResponse>({ customLogLevel: (req: CustomRequest, res: CustomResponse, error: Error | undefined) => error ? 'error' : 'info' });

// #customProps
pinoHttp({ customProps: (req: IncomingMessage, res: ServerResponse) => ({ key1: 'value1', 'x-key-2': 'value2' }) });
pinoHttp<CustomRequest, CustomResponse>({ customProps: (req: CustomRequest, res: CustomResponse) => ({ key1: 'value1', 'x-key-2': 'value2' }) });

// #wrapSerializers
pinoHttp({ wrapSerializers: false });

// streams
pinoHttp(new Writable());

// #quietReqLogger + #customAttributeKeys
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
  customLogLevel: canBeUndefined((req: IncomingMessage, res: ServerResponse, _error: Error | undefined) => rtnLevel()),
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
    params: {},
    query: {},
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
  // res.log and res.allLogs should be available
  response.log.info("Logging works on response");
  request.allLogs[0].info("allLogs available on response");
  response.end("Hello world");
};

// custom levels added in the options should be available
// on the logger returned by pino-http
pinoHttp<IncomingMessage, ServerResponse, 'bark'>({
    customLevels: {
        bark: 25,
    }
}).logger.bark("arf arf");

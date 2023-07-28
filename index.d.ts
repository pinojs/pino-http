// Project: https://github.com/pinojs/pino-http#readme
// Definitions by: Christian Rackerseder <https://github.com/screendriver>
//                 Jeremy Forsythe <https://github.com/jdforsythe>
//                 Griffin Yourick <https://github.com/tough-griff>
//                 Jorge Barnaby <https://github.com/yorch>
//                 Jose Ramirez <https://github.com/jarcodallo>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped
// TypeScript Version: 4.0
/// <reference types="node"/>

import { IncomingMessage, ServerResponse } from 'http';
import pino from 'pino';
import { err, req, res, SerializedError, SerializedRequest, SerializedResponse } from 'pino-std-serializers';

declare function PinoHttp(opts?: Options, stream?: pino.DestinationStream): HttpLogger;

declare function PinoHttp(stream?: pino.DestinationStream): HttpLogger;

export interface HttpLogger {
    (req: IncomingMessage, res: ServerResponse, next?: () => void): void;
    logger: pino.Logger;
}
export type ReqId = number | string | object;

export interface Options extends pino.LoggerOptions {
    logger?: pino.Logger | undefined;
    genReqId?: GenReqId | undefined;
    useLevel?: pino.LevelWithSilent | undefined;
    stream?: pino.DestinationStream | undefined;
    autoLogging?: boolean | AutoLoggingOptions | undefined;
    customLogLevel?: ((req: IncomingMessage, res: ServerResponse, error?: Error) => pino.LevelWithSilent) | undefined;
    customReceivedMessage?: ((req: IncomingMessage, res: ServerResponse) => string) | undefined;
    customSuccessMessage?: ((req: IncomingMessage, res: ServerResponse, responseTime: number) => string) | undefined;
    customErrorMessage?: ((req: IncomingMessage, res: ServerResponse, error: Error) => string) | undefined;
    customReceivedObject?: ((req: IncomingMessage, res: ServerResponse, val?: any) => any) | undefined;
    customSuccessObject?: ((req: IncomingMessage, res: ServerResponse, val: any) => any) | undefined;
    customErrorObject?: ((req: IncomingMessage, res: ServerResponse, error: Error, val: any) => any) | undefined;
    customAttributeKeys?: CustomAttributeKeys | undefined;
    wrapSerializers?: boolean | undefined;
    customProps?: ((req: IncomingMessage, res: ServerResponse) => object) | undefined;
    quietReqLogger?: boolean | undefined;
}

export interface GenReqId {
    (req: IncomingMessage, res: ServerResponse): ReqId;
}

export interface AutoLoggingOptions {
    ignore?: ((req: IncomingMessage) => boolean);
}

export interface CustomAttributeKeys {
    req?: string | undefined;
    res?: string | undefined;
    err?: string | undefined;
    reqId?: string | undefined;
    responseTime?: string | undefined;
}

export interface StdSerializers {
    err: typeof err;
    req: typeof req;
    res: typeof res;
}

export interface StdSerializedResults {
    err: SerializedError;
    req: SerializedRequest;
    res: SerializedResponse;
}

export default PinoHttp;
export { PinoHttp as pinoHttp };

export const startTime: unique symbol;

export const stdSerializers: StdSerializers;

declare module "http" {
    interface IncomingMessage {
      id: ReqId;
      log: pino.Logger;
      allLogs: pino.Logger[];
    }

    interface ServerResponse {
      err?: Error | undefined;
    }

    interface OutgoingMessage {
      [startTime]: number;
      log: pino.Logger;
      allLogs: pino.Logger[];
    }
  }

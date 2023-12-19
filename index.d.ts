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

declare function PinoHttp<IM = IncomingMessage, SR = ServerResponse, CustomLevels extends string = never>(opts?: Options<IM, SR, CustomLevels>, stream?: pino.DestinationStream): HttpLogger<IM, SR, CustomLevels>;

declare function PinoHttp<IM = IncomingMessage, SR = ServerResponse>(stream?: pino.DestinationStream): HttpLogger<IM, SR>;

export interface HttpLogger<IM = IncomingMessage, SR = ServerResponse, CustomLevels extends string = never> {
    (req: IM, res: SR, next?: () => void): void;
    logger: pino.Logger<CustomLevels>;
}
export type ReqId = number | string | object;

export interface Options<IM = IncomingMessage, SR = ServerResponse, CustomLevels extends string = never> extends pino.LoggerOptions {
    logger?: pino.Logger<CustomLevels> | undefined;
    genReqId?: GenReqId<IM, SR> | undefined;
    useLevel?: pino.LevelWithSilent | undefined;
    stream?: pino.DestinationStream | undefined;
    autoLogging?: boolean | AutoLoggingOptions<IM> | undefined;
    customLogLevel?: ((req: IM, res: SR, error?: Error) => pino.LevelWithSilent) | undefined;
    customReceivedMessage?: ((req: IM, res: SR) => string) | undefined;
    customSuccessMessage?: ((req: IM, res: SR, responseTime: number) => string) | undefined;
    customErrorMessage?: ((req: IM, res: SR, error: Error) => string) | undefined;
    customReceivedObject?: ((req: IM, res: SR, val?: any) => any) | undefined;
    customSuccessObject?: ((req: IM, res: SR, val: any) => any) | undefined;
    customErrorObject?: ((req: IM, res: SR, error: Error, val: any) => any) | undefined;
    customAttributeKeys?: CustomAttributeKeys | undefined;
    wrapSerializers?: boolean | undefined;
    customProps?: ((req: IM, res: SR) => object) | undefined;
    quietReqLogger?: boolean | undefined;
}

export interface GenReqId<IM = IncomingMessage, SR = ServerResponse> {
    (req: IM, res: SR): ReqId;
}

export interface AutoLoggingOptions<IM = IncomingMessage> {
    ignore?: ((req: IM) => boolean);
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

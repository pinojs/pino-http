# pino-http&nbsp;&nbsp;[![Build Status](https://img.shields.io/github/workflow/status/pinojs/pino-http/CI)](https://github.com/pinojs/pino-http/actions)

High-speed HTTP logger for Node.js

To our knowledge, `pino-http` is the [fastest](#benchmarks) HTTP logger in town.

* [Installation](#install)
* [Example](#example)
* [Benchmarks](#benchmarks)
* [API](#api)
* [Team](#team)
* [Acknowledgements](#acknowledgements)
* [License](#license)

## Benchmarks

Benchmarks log each request/response pair while returning
`'hello world'`, using
[autocannon](https://github.com/mcollina/autocannon) with 100
connections and 10 pipelined requests.

* `http-ndjson` (equivalent info): 7730.73 req/sec
* `http-ndjson` (standard minimum info): 9522.37 req/sec
* `pino-http`: 21496 req/sec
* `pino-http` (extreme): 25770.91 req/sec
* no logger: 46139.64 req/sec

All benchmarks where taken on a Macbook Pro 2013 (2.6GHZ i7, 16GB of RAM).

## Install

```
npm i pino-http --save
```

## Example

```js
'use strict'

const http = require('http')
const server = http.createServer(handle)

const logger = require('pino-http')()

function handle (req, res) {
  logger(req, res)
  req.log.info('something else')
  res.end('hello world')
}

server.listen(3000)
```

```
$ node example.js | pino-pretty
[2016-03-31T16:53:21.079Z] INFO (46316 on MBP-di-Matteo): something else
    req: {
      "id": 1,
      "method": "GET",
      "url": "/",
      "headers": {
        "host": "localhost:3000",
        "user-agent": "curl/7.43.0",
        "accept": "*/*"
      },
      "remoteAddress": "::1",
      "remotePort": 64386
    }
[2016-03-31T16:53:21.087Z] INFO (46316 on MBP-di-Matteo): request completed
    res: {
      "statusCode": 200,
      "header": "HTTP/1.1 200 OK\r\nX-Powered-By: restify\r\nContent-Type: text/html; charset=utf-8\r\nContent-Length: 11\r\nETag: W/\"b-XrY7u+Ae7tCTyyK7j1rNww\"\r\nDate: Thu, 31 Mar 2016 16:53:21 GMT\r\nConnection: keep-alive\r\n\r\n"
    }
    responseTime: 10
    req: {
      "id": 1,
      "method": "GET",
      "url": "/",
      "headers": {
        "host": "localhost:3000",
        "user-agent": "curl/7.43.0",
        "accept": "*/*"
      },
      "remoteAddress": "::1",
      "remotePort": 64386
    }
```

## API

### pinoHttp([opts], [stream])

`opts`: it has all the options as [pino](http://npm.im/pino) and

* `logger`: parent pino instance for a child logger instance, which will be used by `pino-http`. To refer to this child instance, use [pinoHttp.logger](#pinohttplogger-plogger)
* `genReqId`: you can pass a function which gets used to generate a request id. The first argument is the request itself. As fallback `pino-http` is just using an integer. This default might not be the desired behavior if you're running multiple instances of the app
* `useLevel`: the logger level `pino-http` is using to log out the response. default: `info`
* `customLogLevel`: set to a `function (req, res, err) => { /* returns level name string */ }`. This function will be invoked to determine the level at which the log should be issued (`silent` will prevent logging). This option is mutually exclusive with the `useLevel` option. The first two arguments are the HTTP request and response. The third argument is an error object if an error has occurred in the request.
* `autoLogging`: set to `false`, to disable the automatic "request completed" and "request errored" logging. Defaults to `true`. If set to an object, you can provide more options.
* `autoLogging.ignore`: set to a `function (req) => { /* returns boolean */ }`. Useful for defining logic based on req properties (such as a user-agent header) to ignore successful requests.
* `stream`: same as the second parameter
* `customReceivedMessage`: set to a `function (req, res) => { /* returns message string */ }` This function will be invoked at each request received, setting "msg" property to returned string. If not set, nothing value will be used.
* `customReceivedObject`: set to a `function (req, res, loggableObject) => { /* returns loggable object */ }` This function will be invoked at each request received, replacing the base loggable received object. When set, it is up to the reponsibility of the caller to merge with the `loggableObject` parameter. If not set, default value will be used.
* `customSuccessMessage`: set to a `function (req, res) => { /* returns message string */ }` This function will be invoked at each successful response, setting "msg" property to returned string. If not set, default value will be used.
* `customSuccessObject`: set to a `function (req, res, loggableObject) => { /* returns loggable object */ }` This function will be invoked at each successful response, replacing the base loggable success object. When set, it is up to the reponsibility of the caller to merge with the `loggableObject` parameter. If not set, default value will be used.
* `customErrorMessage`: set to a `function (req, res, err) => { /* returns message string */ }` This function will be invoked at each failed response, setting "msg" property to returned string. If not set, default value will be used.
* `customErrorObject`: set to a `function (req, res, err, loggableObject) => { /* returns loggable object */ }` This function will be invoked at each failed response, the base loggable error object. When set, it is up to the reponsibility of the caller to merge with the `loggableObject` parameter. If not set, default value will be used.
* `customAttributeKeys`: allows the log object attributes added by `pino-http` to be given custom keys. Accepts an object of format `{ [original]: [override] }`. Attributes available for override are `req`, `res`, `err`, `responseTime` and, when using quietReqLogger, `reqId`.
* `wrapSerializers`: when `false`, custom serializers will be passed the raw value directly. Defaults to `true`.
* `customProps`: set to a `function (req, res) => { /* returns on object */ }` or `{ /* returns on object */ }` This function will be invoked for each request with `req` and `res` where we could pass additional properties that need to be logged outside the `req`.
* `quietReqLogger`: when `true`, the child logger available on `req.log` will no longer contain the full bindings and will now only have the request id bound at `reqId` (note: the autoLogging messages and the logger available on `res.log` will remain the same except they will also have the additional `reqId` property). default: `false`

`stream`: the destination stream. Could be passed in as an option too.

#### Examples

##### Logger options

```js
'use strict'

const http = require('http')
const server = http.createServer(handle)
const { randomUUID } = require('node:crypto')
const pino = require('pino')
const logger = require('pino-http')({
  // Reuse an existing logger instance
  logger: pino(),

  // Define a custom request id function
  genReqId: function (req, res) {
    if (req.id) return req.id
    let id = req.get('X-Request-Id')
    if (id) return id
    id = randomUUID()
    res.header('X-Request-Id', id)
    return id
  },

  // Define custom serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  },

  // Set to `false` to prevent standard serializers from being wrapped.
  wrapSerializers: true,

  // Logger level is `info` by default
  useLevel: 'info',

  // Define a custom logger level
  customLogLevel: function (req, res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    } else if (res.statusCode >= 500 || err) {
      return 'error'
    } else if (res.statusCode >= 300 && res.statusCode < 400) {
      return 'silent'
    }
    return 'info'
  },

  // Define a custom success message
  customSuccessMessage: function (req, res) {
    if (res.statusCode === 404) {
      return 'resource not found'
    }
    return `${req.method} completed`
  },

  // Define a custom receive message
  customReceivedMessage: function (req, res) {
    return 'request received: ' + req.method
  },

  // Define a custom error message
  customErrorMessage: function (req, res, err) {
    return 'request errored with status code: ' + res.statusCode
  },

  // Override attribute keys for the log object
  customAttributeKeys: {
    req: 'request',
    res: 'response',
    err: 'error',
    responseTime: 'timeTaken'
  },

  // Define additional custom request properties
  customProps: function (req, res) {
    return {
      customProp: req.customProp,
      // user request-scoped data is in res.locals for express applications
      customProp2: res.locals.myCustomData
    }
  }
})

function handle (req, res) {
  logger(req, res)
  req.log.info('something else')
  res.end('hello world')
}

server.listen(3000)
```

##### Structured Object Hooks

It is possible to override the default structured object with your own. The hook is provided with the
pino-http base object so that you can merge in your own keys. 

This is useful in scenarios where you want to augment core pino-http logger object with your own event 
labels.

> If you simply want to change the message which is logged then check out the custom[Received|Error|Success]Message 
> hooks e.g. customReceivedMessage

```js
const logger = require('pino-http')({
  //... remaining config omitted for brevity
  customReceivedObject: (req, res, val) => {
    return {
      category: 'ApplicationEvent',
      eventCode: 'REQUEST_RECEIVED'
    };
  },

  customSuccessObject: (req, res, val) => {
    return {
      ...val,
      category: 'ApplicationEvent',
      eventCode:
        res.statusCode < 300
          ? 'REQUEST_PROCESSED'
          : 'REQUEST_FAILED'
    };
  },

  customErrorObject: (req, res, error, val) => {
    const store = storage.getStore();
    const formattedBaggage = convertBaggageToObject(store?.baggage);

    return {
      ...val,
      category: 'ApplicationEvent',
      eventCode: 'REQUEST_FAILED'
    };
  }

  // ...remaining config omitted for brevity
})
```

##### PinoHttp.logger (P.Logger)

The `pinoHttp` instance has a property `logger`, which references to an actual logger instance, used
by pinoHttp. This instance will be a child of an instance, passed as `opts.logger`, or a fresh one,
if no `opts.logger` is passed. It can be used, for example, for doing most of the things, possible
to do with any `pino` instance, for example changing logging level in runtime, like so:

```js
const pinoHttp = require('pinoHttp')();
pinoHttp.logger.level = 'silent';
```

##### pinoHttp.startTime (Symbol)

The `pinoHttp` function has a property called `startTime` which contains a symbol
that is used to attach and reference a start time on the HTTP `res` object. If the function
returned from `pinoHttp` is not *the first* function to be called in an HTTP servers request
listener function then the `responseTime` key in the log output will be offset by any
processing that happens before a response is logged. This can be corrected by manually attaching
the start time to the `res` object with the `pinoHttp.startTime` symbol, like so:

```js
const http = require('http')
const logger = require('pino-http')()
const someImportantThingThatHasToBeFirst = require('some-important-thing')
http.createServer((req, res) => {
  res[logger.startTime] = Date.now()
  someImportantThingThatHasToBeFirst(req, res)
  logger(req, res)
  res.end('hello world')
}).listen(3000)
```

##### Custom formatters

You can customize the format of the log output by passing a [Pino transport](https://github.com/pinojs/pino/blob/master/docs/transports.md#v7-transports).

```js
const logger = require('pino-http')({
  quietReqLogger: true, // turn off the default logging output
  transport: {
    target: 'pino-http-print', // use the pino-http-print transport and its formatting output
    options: {
      destination: 1,
      all: true,
      translateTime: true
    }
  }
})
```


#### Default serializers

##### pinoHttp.stdSerializers.req

Generates a JSONifiable object from the HTTP `request` object passed to
the `createServer` callback of Node's HTTP server.

It returns an object in the form:

```js
{
  pid: 93535,
  hostname: 'your host',
  level: 30,
  msg: 'my request',
  time: '2016-03-07T12:21:48.766Z',
  v: 0,
  req: {
    id: 42,
    method: 'GET',
    url: '/',
    headers: {
      host: 'localhost:50201',
      connection: 'close'
    },
    remoteAddress: '::ffff:127.0.0.1',
    remotePort: 50202
  }
}
```

##### pinoHttp.stdSerializers.res

Generates a JSONifiable object from the HTTP `response` object passed to
the `createServer` callback of Node's HTTP server.

It returns an object in the form:

```js
{
  pid: 93581,
  hostname: 'myhost',
  level: 30,
  msg: 'my response',
  time: '2016-03-07T12:23:18.041Z',
  v: 0,
  res: {
    statusCode: 200,
    header: 'HTTP/1.1 200 OK\r\nDate: Mon, 07 Mar 2016 12:23:18 GMT\r\nConnection: close\r\nContent-Length: 5\r\n\r\n'
  }
}
```

#### Custom serializers

Each of the standard serializers can be extended by supplying a corresponding
custom serializer. For example, let's assume the `request` object has custom
properties attached to it, and that all of the custom properties are prefixed
by `foo`. In order to show these properties, along with the standard serialized
properties, in the resulting logs, we can supply a serializer like:

```js
const logger = require('pino-http')({
  serializers: {
    req (req) {
      Object.keys(req.raw).forEach((k) => {
        if (k.startsWith('foo')) {
          req[k] = req.raw[k]
        }
      })
      return req
    }
  }
})
```

If you prefer to work with the raw value directly, or you want to honor the custom
serializers already defined by `opts.logger`, you can pass in `opts.wrapSerializers`
as `false`:

```js
const logger = require('pino-http')({
  wrapSerializers: false,
  serializers: {
    req (req) {
      // `req` is the raw `IncomingMessage` object, not the already serialized request from `pino.stdSerializers.req`.
      return {
        message: req.foo
      };
    }
  }
})
```

##### Logging request body

Logging of requests' bodies is disabled by default since it can cause security risks such as having private user information (password, other GDPR-protected data, etc.) logged (and persisted in most setups). However if enabled, sensitive information can be redacted as per [redaction documentation](http://getpino.io/#/docs/redaction).

Furthermore, logging more bytes does slow down throughput. [This video by pino maintainers Matteo Collina & David Mark Clements](https://www.youtube.com/watch?v=zja-_IYNrFc&feature=youtu.be) goes into this in more detail.

After considering these factors, logging of the request body can be achieved as follows:

```js
const http = require('http')
const logger = require('pino-http')({
  serializers: {
    req(req) {
      req.body = req.raw.body;
      return req;
    },
  },
});
```

##### Custom serializers + custom log attribute keys

If custom attribute keys for `req`, `res`, or `err` log keys have been provided, serializers will be applied with the following order of precedence:

`serializer matching custom key` > `serializer matching default key` > `default pino serializer`

## Team

### Matteo Collina

<https://github.com/mcollina>

<https://www.npmjs.com/~matteo.collina>

<https://twitter.com/matteocollina>


### David Mark Clements

<https://github.com/davidmarkclements>

<https://www.npmjs.com/~davidmarkclements>

<https://twitter.com/davidmarkclem>

<a name="acknowledgements"></a>
## Acknowledgements

This project was kindly sponsored by [nearForm](http://nearform.com).

Logo and identity designed by Beibhinn Murphy O'Brien: https://www.behance.net/BeibhinnMurphyOBrien.

## License

MIT

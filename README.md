# pino-http&nbsp;&nbsp;[![Build Status](https://travis-ci.org/pinojs/pino-http.svg)](https://travis-ci.org/pinojs/pino-http)[![Coverage Status](https://coveralls.io/repos/github/pinojs/pino-http/badge.svg?branch=master)](https://coveralls.io/github/pinojs/pino-http?branch=master)

High-speed HTTP logger for Node.js

To our knowledge, `pino-http` is the [fastest](#benchmarks) HTTP logger in town.

* [Installation](#install)
* [Usage](#usage)
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

var http = require('http')
var server = http.createServer(handle)

var logger = require('pino-http')()

function handle (req, res) {
  logger(req, res)
  req.log.info('something else')
  res.end('hello world')
}

server.listen(3000)
```

```
$ node example.js | pino
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

* `logger`: `pino-http` can reuse a pino instance if passed with the `logger` property
* `genReqId`: you can pass a function which gets used to generate a request id. The first argument is the request itself. As fallback `pino-http` is just using an integer. This default might not be the desired behavior if you're running multiple instances of the app
* `useLevel`: the logger level `pino-http` is using to log out the response. default: `info`
* `customLogLevel`: set to a `function (res, err) => { /* returns level name string */ }`. This function will be invoked to determine the level at which the log should be issued. This option is mutually exclusive with the `useLevel` option. The first argument is the HTTP response. The second argument is an error object if an error has occurred in the request.
* `autoLogging`: set to `false` to disable the automatic "request completed" and "request errored" logging. Defaults to `true`.
* `stream`: same as the second parameter

`stream`: the destination stream. Could be passed in as an option too.

#### Examples

##### Logger options

```js
'use strict'

var http = require('http')
var server = http.createServer(handle)
var pino = require('pino')
var logger = require('pino-http')({
  // Reuse an existing logger instance
  logger: pino(),

  // Define a custom request id function
  genReqId: function (req) { return req.id },

  // Define custom serializers
  serializers: {
    err: pino.stdSerializers.err,
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  },

  // Logger level is `info` by default
  useLevel: 'info',


  // Define a custom logger level
  customLogLevel: function (res, err) {
    if (res.statusCode >= 400 && res.statusCode < 500) {
      return 'warn'
    } else if (res.statusCode >= 500 || err) {
      return 'error'
    }
    return 'info'
  }
})

function handle (req, res) {
  logger(req, res)
  req.log.info('something else')
  res.end('hello world')
}

server.listen(3000)
```

##### pinoHttp.startTime (Symbol)

The `pinoHttp` function has a property called `startTime` which contains a symbol
that is used to attach and reference a start time on the HTTP `res` object. If the function
returned from `pinoHttp` is not *the first* function to be called in an HTTP servers request
listener function then the `responseTime` key in the log output will be offset by any
processing that happens before a response is logged. This can be corrected by manually attaching
the start time to the `res` object with the `pinoHttp.startTime` symbol, like so:

```js
var http = require('http')
var logger = require('pino-http')()
var someImportantThingThatHasToBeFirst = require('some-important-thing')
http.createServer((req, res) => {
  res[logger.startTime] = Date.now()
  someImportantThingThatHasToBeFirst(req, res)
  logger(req, res)
  res.end('hello world')
}).listen(3000)
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
var http = require('http')
var logger = require('pino-http')({
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

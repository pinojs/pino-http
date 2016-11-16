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

### pinoHttp([options], [stream])

#### options

`pino-http` has the same options as [pino](http://npm.im/pino).
`pino-http` attaches listeners to the request, in order to log when the request completes

##### logger

`pino-http` can reuse a pino instance if passed with the `logger`
property

##### genReqId

You can pass a `genReqId` function which gets used to generate a request id. The first argument is the request itself.

As fallback `pino-http` is just using an integer. This default might not be the desired behavior if you're running multiple instances of the app.

#### Examples

##### Logger options

```js
'use strict'

var http = require('http')
var server = http.createServer(handle)
var pino = require('pino')()
var logger = require('pino-http')({
  // Reuse an existing logger instance
  logger: pino,

  // Define a custom request id function
  genReqId: function (req) { return req.id },

  // Define custom serializers
  serializers: {
    req: pino.stdSerializers.req,
    res: pino.stdSerializers.res
  }
})

function handle (req, res) {
  logger(req, res)
  req.log.info('something else')
  res.end('hello world')
}

server.listen(3000)
```


#### Default serializers

### pinoHttp.stdSerializers.req

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

## Team

### Matteo Collina

<https://github.com/mcollina>

<https://www.npmjs.com/~matteo.collina>

<https://twitter.com/matteocollina>


### David Mark Clements

<https://github.com/davidmarkclements>

<https://www.npmjs.com/~davidmarkclements>

<https://twitter.com/davidmarkclem>

## License

MIT

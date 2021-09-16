'use strict'

var test = require('tap').test
var http = require('http')
var pinoHttp = require('./')
var pino = require('pino')
var split = require('split2')

var ERROR_URL = '/make-error'
var noop = function () {}

function setup (t, logger, cb, handler, next) {
  var server = http.createServer(handler || function (req, res) {
    logger(req, res, next)
    if (req.url === '/') {
      res.end('hello world')
      return
    } else if (req.url === ERROR_URL) {
      res.statusCode = 500
      res.end('error')
      return
    }
    res.statusCode = 404
    res.end('Not Found')
  })

  server.listen(0, '127.0.0.1', function (err) {
    cb(err || null, server)
  })
  t.teardown(function (cb) {
    server.close(cb)
  })

  return server
}

function doGet (server, path, callback) {
  path = path || '/'
  var address = server.address()
  var cb = callback || noop
  return http.get('http://' + address.address + ':' + address.port + path, cb)
}

test('default settings', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.equal(line.msg, 'request completed', 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('stream in options', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({ stream: dest })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.equal(line.msg, 'request completed', 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('exposes the internal pino', function (t) {
  t.plan(1)

  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)

  dest.on('data', function (line) {
    t.equal(line.msg, 'hello world')
  })

  logger.logger.info('hello world')
})

test('uses the log level passed in as an option', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({ useLevel: 'debug', level: 'debug' }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.level, 20, 'level')
    t.notOk(line.useLevel, 'useLevel not forwarded')
    t.end()
  })
})

test('uses the custom log level passed in as an option', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    customLogLevel: function (res, err) {
      return 'warn'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.level, 40, 'level')
    t.notOk(line.customLogLevel, 'customLogLevel not forwarded')
    t.end()
  })
})

test('throw error if custom log level and log level passed in together', function (t) {
  var dest = split(JSON.parse)
  var throwFunction = function () {
    pinoHttp({
      useLevel: 'info',
      customLogLevel: function (res, err) {
        return 'warn'
      }
    }, dest)
  }
  t.throws(throwFunction, { message: "You can't pass 'useLevel' and 'customLogLevel' together" })
  t.end()
})

test('allocate a unique id to every request', function (t) {
  t.plan(5)

  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)
  var lastId = null

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.not(line.req.id, lastId)
    lastId = line.req.id
    t.ok(line.req.id, 'req.id is defined')
  })
})

test('uses a custom genReqId function', function (t) {
  t.plan(4)

  var dest = split(JSON.parse)
  var idToTest
  function genReqId (req) {
    t.ok(req.url, 'The first argument must be the request parameter')
    idToTest = (Date.now() + Math.random()).toString(32)
    return idToTest
  }

  var logger = pinoHttp({ genReqId: genReqId }, dest)
  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(typeof line.req.id, 'string')
    t.equal(line.req.id, idToTest)
  })
})

test('reuses existing req.id if present', function (t) {
  t.plan(2)

  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)
  var someId = 'id-to-reuse-12345'

  function loggerWithExistingReqId (req, res) {
    req.id = someId
    logger(req, res)
  }

  setup(t, loggerWithExistingReqId, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.req.id, someId)
  })
})

test('startTime', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)
  var someStartTime = 56

  t.equal(typeof pinoHttp.startTime, 'symbol')

  function loggerWithStartTime (req, res) {
    res[pinoHttp.startTime] = someStartTime
    logger(req, res)
    t.equal(res[pinoHttp.startTime], someStartTime)
  }

  setup(t, loggerWithStartTime, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(typeof line.responseTime, 'number')
    t.end()
  })
})

test('responseTime', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.responseTime >= 0, 'responseTime is defined')
    t.end()
  })
})

test('responseTime for errored request', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    t.ok(line.responseTime >= 0, 'responseTime is defined')
    t.equal(line.msg, 'request errored', 'message is set')
    t.end()
  })
})

test('responseTime for request emitting error event', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)

  function handle (req, res) {
    logger(req, res)
    res.emit('error', new Error('Some error'))
    res.end()
  }

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  }, handle)

  dest.on('data', function (line) {
    t.ok(line.responseTime >= 0, 'responseTime is defined')
    t.end()
  })
})

test('no auto logging with autoLogging set to false', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({ autoLogging: false }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      var line = dest.read()
      t.equal(line, null)
      t.end()
    })
  })
})

test('no auto logging with autoLogging set to true and path ignored', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    autoLogging: {
      ignorePaths: ['/ignorethis']
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, '/ignorethis', function () {
      var line = dest.read()
      t.equal(line, null)
      t.end()
    })
  })
})

test('auto logging with autoLogging set to true and path not ignored', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    autoLogging: {
      ignorePaths: ['/ignorethis']
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, '/shouldlogthis')
  })

  dest.on('data', function (line) {
    t.pass('path should log')
    t.end()
  })
})

test('no auto logging with autoLogging set to true and getPath result is ignored', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    autoLogging: {
      ignorePaths: ['/ignorethis'],
      getPath: function (req) {
        return req.url
      }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, '/ignorethis', function () {
      var line = dest.read()
      t.equal(line, null)
      t.end()
    })
  })
})

test('auto logging with autoLogging set to true and getPath result is not ignored', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    autoLogging: {
      ignorePaths: ['/ignorethis'],
      getPath: function (req) {
        return req.url
      }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, '/shouldlogthis')
  })

  dest.on('data', function (line) {
    t.pass('path should log')
    t.end()
  })
})

test('no auto logging with autoLogging set to use regular expressions. result is ignored', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    autoLogging: {
      ignorePaths: [/\/[A-z]{4}\/ignorethis/, '/another-ignored-path'],
      getPath: function (req) {
        return req.url
      }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, '/abcd/ignorethis')
    doGet(server, '/another-ignored-path')
    doGet(server, '/abcd0/shouldlogthis')
  })

  dest.on('data', function (line) {
    t.pass('path should log')
    t.end()
  })
})

test('no auto logging with autoLogging set to true and ignoring a specific user-agent', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    autoLogging: {
      ignore: function (req) {
        return req.headers['user-agent'] === 'ELB-HealthChecker/2.0'
      }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)

    const { address, port } = server.address()
    http.get({
      protocol: 'http:',
      hostname: address,
      port,
      path: '/',
      headers: { 'User-Agent': 'ELB-HealthChecker/2.0' }
    }, function () {
      const line = dest.read()
      t.equal(line, null)
      t.end()
    })
  })
})

test('support a custom instance', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    logger: pino(dest)
  })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.equal(line.msg, 'request completed', 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('support a custom instance with custom genReqId function', function (t) {
  var dest = split(JSON.parse)

  var idToTest
  function genReqId (req) {
    t.ok(req.url, 'The first argument must be the request parameter')
    idToTest = (Date.now() + Math.random()).toString(32)
    return idToTest
  }

  var logger = pinoHttp({
    logger: pino(dest),
    genReqId: genReqId
  })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.notOk(line.genReqId)
    t.equal(line.msg, 'request completed', 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('does not crash when no request connection object', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    logger: pino(dest)
  })
  t.plan(1)

  var server = http.createServer(handler)
  server.unref()
  server.listen(9999, () => {
    http.get('http://127.0.0.1:9999', (res) => {
      t.pass('made it through logic path without crashing')
    })
  })

  function handler (req, res) {
    delete req.connection
    logger(req, res)
    res.end()
  }
})

// https://github.com/pinojs/pino-http/issues/42
test('does not return excessively long object', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        delete req.connection
        return req
      }
    }
  })
  t.plan(1)

  var server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => {})
  })

  function handler (req, res) {
    logger(req, res)
    res.end()
  }

  dest.on('data', function (obj) {
    t.equal(Object.keys(obj.req).length, 6)
  })
})

test('err.raw is available to custom serializers', function (t) {
  t.plan(1)
  const error = new Error('foo')
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      err (err) {
        t.equal(err.raw, error)
      }
    }
  })

  const server = http.createServer((req, res) => {
    logger(req, res)
    res.err = error
    res.end()
  })
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => {})
  })
})

test('req.raw is available to custom serializers', function (t) {
  t.plan(2)
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        t.ok(req.raw)
        t.ok(req.raw.connection)
        return req
      }
    }
  })

  var server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => {})
  })

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('res.raw is available to custom serializers', function (t) {
  t.plan(2)
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      res: function (res) {
        t.ok(res.raw)
        t.ok(res.raw.statusCode)
        return res
      }
    }
  })

  var server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => {})
  })

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('res.raw is not enumerable', function (t) {
  t.plan(1)
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      res: function (res) {
        t.equal(Object.prototype.propertyIsEnumerable.call(res, 'raw'), false)
        return res
      }
    }
  })

  var server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => {})
  })

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('err.raw, req.raw and res.raw are passed into custom serializers directly, when opts.wrapSerializers is false', (t) => {
  t.plan(6)
  const error = new Error('foo')
  const dest = split(JSON.parse)

  const server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => {})
  })

  function handler (request, response) {
    const logger = pinoHttp({
      logger: pino(dest),
      wrapSerializers: false,
      serializers: {
        err: function (err) {
          t.notOk(err.raw)
          t.equal(err, error)
          return err
        },
        req: function (req) {
          t.notOk(req.raw)
          t.equal(req, request)
          return req
        },
        res: function (res) {
          t.notOk(res.raw)
          t.equal(res, response)
          return res
        }
      }
    })
    logger(request, response)
    response.err = error
    response.end()
  }
})

test('req.id has a non-function value', function (t) {
  t.plan(1)
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        t.equal(typeof req.id === 'function', false)
        return req
      }
    }
  })

  var server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => {})
  })

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('uses the custom successMessage callback if passed in as an option', function (t) {
  var dest = split(JSON.parse)
  var customResponseMessage = 'Custom response message'
  var logger = pinoHttp({
    customSuccessMessage: function (res) {
      return customResponseMessage
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.msg, customResponseMessage)
    t.end()
  })
})

test('uses the custom errorMessage callback if passed in as an option', function (t) {
  var dest = split(JSON.parse)
  var customErrorMessage = 'Custom error message'
  var logger = pinoHttp({
    customErrorMessage: function (err, res) {
      return customErrorMessage + ' ' + err.toString()
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    t.equal(line.msg.indexOf(customErrorMessage), 0)
    t.end()
  })
})

test('uses custom log object attribute keys when provided, successful request', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    customAttributeKeys: {
      req: 'httpReq',
      res: 'httpRes',
      err: 'httpErr',
      responseTime: 'timeTaken'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.httpReq, 'httpReq is defined')
    t.ok(line.httpRes, 'httpRes is defined')
    t.equal(typeof line.timeTaken, 'number')
    t.end()
  })
})

test('uses custom log object attribute keys when provided, error request', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    customAttributeKeys: {
      req: 'httpReq',
      res: 'httpRes',
      err: 'httpErr',
      responseTime: 'timeTaken'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    t.ok(line.httpReq, 'httpReq is defined')
    t.ok(line.httpRes, 'httpRes is defined')
    t.ok(line.httpErr, 'httpRes is defined')
    t.equal(typeof line.timeTaken, 'number')
    t.end()
  })
})

test('uses custom request properties to log additional attributes when provided', function (t) {
  var dest = split(JSON.parse)
  function customPropsHandler (req, res) {
    if (req && res) {
      return {
        key1: 'value1',
        key2: 'value2'
      }
    }
  }
  var logger = pinoHttp({
    customProps: customPropsHandler
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.key1, 'value1')
    t.equal(line.key2, 'value2')
    t.end()
  })
})

test('uses old custom request properties interface to log additional attributes', function (t) {
  var dest = split(JSON.parse)
  function customPropsHandler (req, res) {
    if (req && res) {
      return {
        key1: 'value1',
        key2: 'value2'
      }
    }
  }
  var logger = pinoHttp({
    reqCustomProps: customPropsHandler
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.key1, 'value1')
    t.equal(line.key2, 'value2')
    t.end()
  })
})

test('uses custom request properties to log additional attributes; custom props is an object instead of callback', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    customProps: { key1: 'value1' }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.key1, 'value1')
    t.end()
  })
})

test('dont pass custom request properties to log additional attributes', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp({
    customProps: undefined
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.hostname, 'hostname is defined')
    t.ok(line.level, 'level is defined')
    t.ok(line.msg, 'msg is defined')
    t.ok(line.pid, 'pid is defined')
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.ok(line.time, 'time is defined')
    t.end()
  })
})

test('auto logging and next callback', function (t) {
  t.plan(3)
  var dest = split(JSON.parse)
  var logger = pinoHttp({ autoLogging: true }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      var line = dest.read()
      t.equal(line.msg, 'request completed')
    })
  }, function (req, res) {
    logger(req, res, function () {
      t.pass('called')
      res.end('hello world')
    })
  })
})

test('quiet request logging', function (t) {
  t.plan(8)
  var dest = split(JSON.parse)
  var logger = pinoHttp({ quietReqLogger: true }, dest)

  function handler (req, res) {
    t.pass('called')
    req.id = 'testId'
    logger(req, res)
    req.log.info('quiet message')
    res.end('hello world')
  }

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      var quietLine = dest.read()
      t.equal(quietLine.msg, 'quiet message')
      t.equal(quietLine.reqId, 'testId')
      t.notOk(quietLine.req)

      var responseLine = dest.read()
      t.equal(responseLine.msg, 'request completed')
      t.equal(responseLine.reqId, 'testId')
      t.ok(responseLine.req)
    })
  }, handler)
})

test('quiet request logging - custom request id key', function (t) {
  t.plan(8)
  var dest = split(JSON.parse)
  var logger = pinoHttp({ quietReqLogger: true, customAttributeKeys: { reqId: 'customRequestId' } }, dest)

  function handler (req, res) {
    t.pass('called')
    req.id = 'testId'
    logger(req, res)
    req.log.info('quiet message')
    res.end('hello world')
  }

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      var quietLine = dest.read()
      t.equal(quietLine.msg, 'quiet message')
      t.notOk(quietLine.req)
      t.equal(quietLine.customRequestId, 'testId')

      var responseLine = dest.read()
      t.equal(responseLine.msg, 'request completed')
      t.equal(responseLine.customRequestId, 'testId')
      t.ok(responseLine.req)
    })
  }, handler)
})

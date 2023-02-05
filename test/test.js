'use strict'

const test = require('tap').test
const http = require('http')
const net = require('net')
const stream = require('stream')
const pinoHttp = require('../')
const pino = require('pino')
const split = require('split2')
const { join } = require('path')

const ERROR_URL = '/make-error'
const noop = function () {}

const DEFAULT_REQUEST_RECEIVED_MSG = 'request received'
const DEFAULT_REQUEST_COMPLETED_MSG = 'request completed'
const DEFAULT_REQUEST_ABORTED_MSG = 'request aborted'
const DEFAULT_REQUEST_ERROR_MSG = 'request errored'

function setup (t, logger, cb, handler, next) {
  const server = http.createServer(handler || function (req, res) {
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
  const address = server.address()
  const cb = callback || noop
  return http.get('http://' + address.address + ':' + address.port + path, cb)
}

test('default settings', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('stream in options', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({ stream: dest })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('add transport.caller information when missing', function (t) {
  t.plan(1)

  const options = {
    transport: {
      targets: [
        { target: 'pino/file', options: { destination: (process.platform !== 'win32') ? '/dev/null' : undefined } }
      ]
    }
  }

  const logger = pinoHttp(options)
  logger.logger.info('hello world')
  t.equal(options.transport.caller, join(__dirname, '../logger.js'), 'caller is set')
  t.end()
})

test('exposes the internal pino', function (t) {
  t.plan(1)

  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  dest.on('data', function (line) {
    t.equal(line.msg, 'hello world')
    t.end()
  })

  logger.logger.info('hello world')
})

test('internal pino logger not shared between multiple middleware', function (t) {
  t.plan(1)

  const dest = split(JSON.parse)
  const middleware1 = pinoHttp(dest)
  const middleware2 = pinoHttp(dest)

  t.not(middleware1.logger, middleware2.logger, 'expected loggers not to be shared between middleware invocations')
})

test('when multiple pino middleware are present each pino logger retains its own redact config', function (t) {
  t.plan(6)

  const middleware1Output = split(JSON.parse)
  const middleware2Output = split(JSON.parse)
  const middleware3Output = split(JSON.parse)
  const middleware1 = pinoHttp({ redact: ['req.method'] }, middleware1Output)
  const middleware2 = pinoHttp({ redact: ['req.url'] }, middleware2Output)
  const middleware3 = pinoHttp({}, middleware3Output)

  setup(t, (req, res, next) => {
    middleware1(req, res, next)
    middleware2(req, res, next)
    middleware3(req, res, next)
    t.ok(req.log, 'pino http middleware should have set request log logger to middleware1\'s logger')
    t.equal(req.allLogs.length, 3, 'multiple pino http middleware should have set request additional loggers')
  }, function (err, server) {
    t.error(err)
    doGet(server, '/')
  })

  middleware1Output.on('data', function (line) {
    t.equal(line.req.method, '[Redacted]', 'method is Redacted')
  })

  middleware2Output.on('data', function (line) {
    t.equal(line.req.url, '[Redacted]', 'url is Redacted')
  })

  middleware3Output.on('data', function (line) {
    t.equal(line.req.method, 'GET', 'method is get and not redacted')
  })
})

test('uses the log level passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({ useLevel: 'debug', level: 'debug' }, dest)

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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customLogLevel: function (_req, _res, _err) {
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

test('uses the custom log level passed in as an option, req and res is defined', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customLogLevel: function (_req, _res, _err) {
      t.ok(_req, 'req is defined')
      t.ok(_res, 'res is defined')

      return 'warn'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })
  dest.on('data', function () {
    t.end()
  })
})

test('uses the log level passed in as an option, where the level is a custom one', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(
    {
      customLevels: {
        custom: 25
      },
      useLevel: 'custom',
      level: 'custom'
    },
    dest
  )

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.level, 25, 'level')
    t.notOk(line.useLevel, 'useLevel not forwarded')
    t.end()
  })
})

test('uses the custom log level passed in as an option, where the level itself is also a custom one', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(
    {
      customLevels: {
        custom: 35
      },
      customLogLevel: function (_req, _res, _err) {
        return 'custom'
      }
    },
    dest
  )

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.level, 35, 'level')
    t.notOk(line.customLogLevel, 'customLogLevel not forwarded')
    t.end()
  })
})

test('no autoLogging if useLevel or customLogLevel is silent', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(
    {
      customLogLevel: function (_req, _res, _err) {
        return 'silent'
      }
    },
    dest
  )

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      const line = dest.read()
      t.equal(line, null)
      t.end()
    })
  })
})

test('uses the custom invalid log level passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customLogLevel: function (_req, _res, _err) {
      return 'error-log-level'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.level, 30, 'level')
    t.notOk(line.customLogLevel, 'customLogLevel not forwarded')
    t.end()
  })
})

test('throw error if custom log level and log level passed in together', function (t) {
  const dest = split(JSON.parse)
  const throwFunction = function () {
    pinoHttp({
      useLevel: 'info',
      customLogLevel: function (_req, _res, _err) {
        return 'warn'
      }
    }, dest)
  }
  t.throws(throwFunction, { message: 'You can\'t pass \'useLevel\' and \'customLogLevel\' together' })
  t.end()
})

test('allocate a unique id to every request', function (t) {
  t.plan(5)

  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)
  let lastId = null

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
  t.plan(5)

  const dest = split(JSON.parse)
  let idToTest

  function genReqId (req, res) {
    t.ok(res, 'res is defined')
    t.ok(req.url, 'The first argument must be the request parameter')
    idToTest = (Date.now() + Math.random()).toString(32)
    return idToTest
  }

  const logger = pinoHttp({ genReqId }, dest)
  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(typeof line.req.id, 'string')
    t.equal(line.req.id, idToTest)
    t.end()
  })
})

test('reuses existing req.id if present', function (t) {
  t.plan(2)

  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)
  const someId = 'id-to-reuse-12345'

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
    t.end()
  })
})

test('startTime', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)
  const someStartTime = 56

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
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

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
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    t.ok(line.responseTime >= 0, 'responseTime is defined')
    t.equal(line.msg, DEFAULT_REQUEST_ERROR_MSG, 'message is set')
    t.end()
  })
})

test('responseTime for request emitting error event', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

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

test('log requests aborted during payload', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  function handle (req, res) {
    logger(req, res)

    const read = new stream.Readable({
      read () {
        if (this.called) {
          return
        }

        this.called = true
        this.push('delayed')
      }
    })

    read.pipe(res)
  }

  function listen (err, server) {
    t.error(err)

    const client = net.connect(server.address().port, server.address().address, () => {
      client.write('GET /delayed HTTP/1.1\r\n\r\n')
    })

    client.on('data', (data) => {
      client.destroy()
    })
  }

  setup(t, logger, listen, handle)

  dest.on('data', function (line) {
    t.ok(line.responseTime >= 0, 'responseTime is defined')
    t.equal(line.msg, DEFAULT_REQUEST_ABORTED_MSG, 'message is set')
    t.end()
  })
})

test('no auto logging with autoLogging set to false', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({ autoLogging: false }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      const line = dest.read()
      t.equal(line, null)
      t.end()
    })
  })
})

test('autoLogging set to true and path not ignored', test => {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    autoLogging: {
      ignore: req => req.url === '/ignorethis'
    }
  }, dest)

  setup(test, logger, function (err, server) {
    test.error(err)
    doGet(server, '/shouldlogthis')
  })

  dest.on('data', function (line) {
    test.pass('path should log')
    test.end()
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest)
  })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('support a custom instance with custom genReqId function', function (t) {
  const dest = split(JSON.parse)

  let idToTest

  function genReqId (req, res) {
    t.ok(res, 'res is defined')
    t.ok(req.url, 'The first argument must be the request parameter')
    idToTest = (Date.now() + Math.random()).toString(32)
    return idToTest
  }

  const logger = pinoHttp({
    logger: pino(dest),
    genReqId
  })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.ok(line.req, 'req is defined')
    t.ok(line.res, 'res is defined')
    t.notOk(line.genReqId)
    t.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    t.equal(line.req.method, 'GET', 'method is get')
    t.equal(line.res.statusCode, 200, 'statusCode is 200')
    t.end()
  })
})

test('support a custom instance with one of its customLevels as useLevel', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino({
      customLevels: {
        custom: 25
      }
    }, dest),
    useLevel: 'custom',
    level: 'custom'
  })

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.level, 25, 'level')
    t.notOk(line.useLevel, 'useLevel not forwarded')
    t.end()
  })
})

test('does not crash when no request connection object', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest)
  })
  t.plan(1)

  const server = http.createServer(handler)
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        delete req.connection
        return req
      }
    }
  })
  t.plan(1)

  const server = http.createServer(handler)
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
    t.end()
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
        t.end()
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        t.ok(req.raw)
        t.ok(req.raw.connection)
        return req
      }
    }
  })

  const server = http.createServer(handler)
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      res: function (res) {
        t.ok(res.raw)
        t.ok(res.raw.statusCode)
        t.end()
        return res
      }
    }
  })

  const server = http.createServer(handler)
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      res: function (res) {
        t.equal(Object.prototype.propertyIsEnumerable.call(res, 'raw'), false)
        t.end()
        return res
      }
    }
  })

  const server = http.createServer(handler)
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        t.equal(typeof req.id === 'function', false)
        t.end()
        return req
      }
    }
  })

  const server = http.createServer(handler)
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
  const dest = split(JSON.parse)
  const customResponseMessage = 'Custom response message'
  const logger = pinoHttp({
    customSuccessMessage: function (req, res) {
      return customResponseMessage + ' ' + req.method
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.msg, customResponseMessage + ' GET')
    t.end()
  })
})

test('pass responseTime argument to the custom successMessage callback', function (t) {
  const dest = split(JSON.parse)
  const customResponseMessage = 'Response time is: '
  const logger = pinoHttp({
    customSuccessMessage: function (req, res, responseTime) {
      return customResponseMessage + responseTime + ' ' + req.method
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.match(line.msg, /Response time is: \d+ GET/)
    t.end()
  })
})

test('uses the custom successObject callback if passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customSuccessObject: function (req, res, val) {
      return { ...val, label: req.method + ' customSuccessObject' }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    t.equal(line.label, 'GET customSuccessObject')
    t.end()
  })
})

test('uses the custom receivedMessage callback if passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const message = DEFAULT_REQUEST_RECEIVED_MSG
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return message
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    if (line.msg === DEFAULT_REQUEST_COMPLETED_MSG) {
      return
    }
    t.equal(line.msg, message)
    t.end()
  })
})

test('uses the custom receivedObject callback if passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customReceivedObject: function (req, val) {
      return { label: req.method + ' customReceivedObject' }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    if (line.label === undefined) {
      return
    }

    t.equal(line.label, 'GET customReceivedObject')
    t.end()
  })
})

test('uses the custom receivedObject + receivedMessage callback if passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return DEFAULT_REQUEST_RECEIVED_MSG
    },

    customReceivedObject: function (req, val) {
      return { label: req.method + ' customReceivedObject' }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  })

  dest.on('data', function (line) {
    if (line.label === undefined && line.msg !== undefined) {
      return
    }

    t.equal(line.msg, DEFAULT_REQUEST_RECEIVED_MSG)
    t.equal(line.label, 'GET customReceivedObject')
    t.end()
  })
})

test('receve receivedMessage before successMessage', function (t) {
  t.plan(3)
  const dest = split(JSON.parse)
  const message = DEFAULT_REQUEST_RECEIVED_MSG
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return message
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      t.equal(dest.read().msg, DEFAULT_REQUEST_RECEIVED_MSG)

      t.equal(dest.read().msg, DEFAULT_REQUEST_COMPLETED_MSG)

      t.end()
    })
  })
})

test('uses the custom errorMessage callback if passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const customErrorMessage = 'Custom error message'
  const logger = pinoHttp({
    customErrorMessage: function (req, res, err) {
      return customErrorMessage + ' ' + req.method + ' ' + err.toString()
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    t.equal(line.msg.indexOf(customErrorMessage + ' GET'), 0)
    t.end()
  })
})

test('uses the custom errorObject callback if passed in as an option', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customErrorObject: function (req, res, err, val) {
      return { ...val, label: 'customErrorObject ' + req.method + ' ' + err.toString() }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    t.equal(line.label.indexOf('customErrorObject GET'), 0)
    t.end()
  })
})

test('receve receivedMessage before errorMessage', function (t) {
  t.plan(3)
  const dest = split(JSON.parse)
  const message = DEFAULT_REQUEST_RECEIVED_MSG
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return message
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL, function () {
      t.equal(dest.read().msg, DEFAULT_REQUEST_RECEIVED_MSG)

      t.equal(dest.read().msg, DEFAULT_REQUEST_ERROR_MSG)

      t.end()
    })
  })
})

test('uses custom log object attribute keys when provided, successful request', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
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
  const dest = split(JSON.parse)

  function customPropsHandler (req, res) {
    if (req && res) {
      return {
        key1: 'value1',
        key2: 'value2'
      }
    }
  }

  const logger = pinoHttp({
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
  const dest = split(JSON.parse)

  function customPropsHandler (req, res) {
    if (req && res) {
      return {
        key1: 'value1',
        key2: 'value2'
      }
    }
  }

  const logger = pinoHttp({
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

test('uses custom request properties to log additional attributes when response provided', function (t) {
  const dest = split(JSON.parse)

  function customPropsHandler (req, res) {
    if (req && res) {
      return {
        key1: 'value1',
        key2: res.statusCode
      }
    }
  }

  const logger = pinoHttp({
    customProps: customPropsHandler
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    t.equal(line.key1, 'value1')
    t.equal(line.key2, 500)
    t.end()
  })
})

test('uses custom request properties and a receivedMessage callback and the properties are set on the receivedMessage', function (t) {
  const dest = split(JSON.parse)
  const message = DEFAULT_REQUEST_RECEIVED_MSG
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return message
    },
    customProps: (req, res) => {
      return {
        key1: 'value1',
        key2: res.statusCode
      }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, ERROR_URL)
  })

  let calls = 0
  dest.on('data', function (line) {
    calls++
    if (line.msg === message) {
      t.equal(line.key1, 'value1')
      t.equal(line.key2, 200)
      t.equal(line.req.url, ERROR_URL)
      t.ok(line.req, 'req is defined')
      t.notOk(line.res, 'res is not defined yet')
    } else if (line.msg === DEFAULT_REQUEST_ERROR_MSG) {
      t.equal(line.key1, 'value1')
      t.equal(line.key2, 500)
      t.equal(line.req.url, ERROR_URL)
      t.ok(line.req, 'req is defined')
      t.ok(line.res, 'res is defined')
    }
    if (calls === 2) {
      t.end()
    }
  })
})

test('uses custom request properties to log additional attributes; custom props is an object instead of callback', function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({ autoLogging: true }, dest)

  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server, null, function () {
      const line = dest.read()
      t.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG)

      t.end()
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
  const dest = split(JSON.parse)
  const logger = pinoHttp({ quietReqLogger: true }, dest)

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
      const quietLine = dest.read()
      t.equal(quietLine.msg, 'quiet message')
      t.equal(quietLine.reqId, 'testId')
      t.notOk(quietLine.req)

      const responseLine = dest.read()
      t.equal(responseLine.msg, DEFAULT_REQUEST_COMPLETED_MSG)
      t.equal(responseLine.reqId, 'testId')
      t.ok(responseLine.req)

      t.end()
    })
  }, handler)
})

test('quiet request logging - custom request id key', function (t) {
  t.plan(8)
  const dest = split(JSON.parse)
  const logger = pinoHttp({ quietReqLogger: true, customAttributeKeys: { reqId: 'customRequestId' } }, dest)

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
      const quietLine = dest.read()
      t.equal(quietLine.msg, 'quiet message')
      t.notOk(quietLine.req)
      t.equal(quietLine.customRequestId, 'testId')

      const responseLine = dest.read()
      t.equal(responseLine.msg, DEFAULT_REQUEST_COMPLETED_MSG)
      t.equal(responseLine.customRequestId, 'testId')
      t.ok(responseLine.req)

      t.end()
    })
  }, handler)
})

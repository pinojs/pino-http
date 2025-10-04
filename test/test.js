'use strict'

const test = require('node:test')
const assert = require('node:assert')
const http = require('node:http')
const net = require('node:net')
const stream = require('node:stream')
const { join } = require('node:path')
const split = require('split2')
const tspl = require('@matteo.collina/tspl')

const pinoHttp = require('../')
const pino = require('pino')

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
  t.after(function (cb) {
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

test('default settings', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.ok(line.req, 'req is defined')
    assert.ok(line.res, 'res is defined')
    assert.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    assert.equal(line.req.method, 'GET', 'method is get')
    assert.equal(line.res.statusCode, 200, 'statusCode is 200')
    end()
  })
})

test('stream in options', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({ stream: dest })

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.ok(line.req, 'req is defined')
    assert.ok(line.res, 'res is defined')
    assert.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    assert.equal(line.req.method, 'GET', 'method is get')
    assert.equal(line.res.statusCode, 200, 'statusCode is 200')
    end()
  })
})

test('add transport.caller information when missing', function () {
  const options = {
    transport: {
      targets: [
        { target: 'pino/file', options: { destination: (process.platform !== 'win32') ? '/dev/null' : undefined } }
      ]
    }
  }

  const logger = pinoHttp(options)
  logger.logger.info('hello world')
  assert.equal(options.transport.caller, join(__dirname, '../logger.js'), 'caller is set')
})

test('exposes the internal pino', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  dest.on('data', function (line) {
    assert.equal(line.msg, 'hello world')
    end()
  })

  logger.logger.info('hello world')
})

test('internal pino logger not shared between multiple middleware', function (t) {
  const dest = split(JSON.parse)
  const middleware1 = pinoHttp(dest)
  const middleware2 = pinoHttp(dest)

  assert.equal(middleware1.logger !== middleware2.logger, true, 'expected loggers not to be shared between middleware invocations')
})

test('req.allLogs is correctly created if it does not exist', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  function handler (req, res) {
    delete req.allLogs

    logger(req, res)

    assert.ok(Array.isArray(req.allLogs), 'req.allLogs should be an array')
    assert.equal(req.allLogs.length, 1, 'req.allLogs should have one logger entry')
    assert.equal(typeof req.allLogs[0].info, 'function', 'req.allLogs should contain a valid logger instance')

    res.end('hello world')
  }

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  }, handler)

  dest.on('data', function () {
    end()
  })
})

test('when multiple pino middleware are present each pino logger retains its own redact config', async function (t) {
  const plan = tspl(t, { plan: 6 })

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
    plan.ok(req.log, 'pino http middleware should have set request log logger to middleware1\'s logger')
    plan.equal(req.allLogs.length, 3, 'multiple pino http middleware should have set request additional loggers')
  }, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, '/')
  })

  middleware1Output.on('data', function (line) {
    plan.equal(line.req.method, '[Redacted]', 'method is Redacted')
  })

  middleware2Output.on('data', function (line) {
    plan.equal(line.req.url, '[Redacted]', 'url is Redacted')
  })

  middleware3Output.on('data', function (line) {
    plan.equal(line.req.method, 'GET', 'method is get and not redacted')
  })

  await plan
})

test('uses the log level passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({ useLevel: 'debug', level: 'debug' }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.level, 20, 'level')
    assert.equal(line.useLevel, undefined, 'useLevel not forwarded')
    end()
  })
})

test('uses the custom log level passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customLogLevel: function (_req, _res, _err) {
      return 'warn'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.level, 40, 'level')
    assert.equal(line.customLogLevel, undefined, 'customLogLevel not forwarded')
    end()
  })
})

test('uses the custom log level passed in as an option, req and res is defined', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customLogLevel: function (_req, _res, _err) {
      assert.ok(_req, 'req is defined')
      assert.ok(_res, 'res is defined')

      return 'warn'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })
  dest.on('data', function () {
    end()
  })
})

test('uses the log level passed in as an option, where the level is a custom one', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(
    {
      customLevels: {
        infoCustom: 25
      },
      useLevel: 'infoCustom',
      level: 'infoCustom'
    },
    dest
  )

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.level, 25, 'level')
    assert.equal(line.useLevel, undefined, 'useLevel not forwarded')
    end()
  })
})

test('uses the custom log level passed in as an option, where the level itself is also a custom one', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.level, 35, 'level')
    assert.equal(line.customLogLevel, undefined, 'customLogLevel not forwarded')
    end()
  })
})

test('no autoLogging if useLevel or customLogLevel is silent', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server)
  })

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server, null, function () {
      const line = dest.read()
      assert.equal(line, null)
      end()
    })
  })
})

test('uses the custom invalid log level passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customLogLevel: function (_req, _res, _err) {
      return 'error-log-level'
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.level, 30, 'level')
    assert.equal(line.customLogLevel, undefined, 'customLogLevel not forwarded')
    end()
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
  assert.throws(throwFunction, { message: 'You can\'t pass \'useLevel\' and \'customLogLevel\' together' })
})

test('allocate a unique id to every request', async function (t) {
  const plan = tspl(t, { plan: 5 })

  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)
  let lastId = null

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server)
    doGet(server)
  })

  dest.on('data', function (line) {
    plan.equal(line.req.id !== lastId, true)
    lastId = line.req.id
    plan.ok(line.req.id, 'req.id is defined')
  })

  await plan
})

test('uses a custom genReqId function', async function (t) {
  const plan = tspl(t, { plan: 5 })

  const dest = split(JSON.parse)
  let idToTest

  function genReqId (req, res) {
    plan.ok(res, 'res is defined')
    plan.ok(req.url, 'The first argument must be the request parameter')
    idToTest = (Date.now() + Math.random()).toString(32)
    return idToTest
  }

  const logger = pinoHttp({ genReqId }, dest)
  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    plan.equal(typeof line.req.id, 'string')
    plan.equal(line.req.id, idToTest)
  })

  await plan
})

test('reuses existing req.id if present', async function (t) {
  const plan = tspl(t, { plan: 2 })

  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)
  const someId = 'id-to-reuse-12345'

  function loggerWithExistingReqId (req, res) {
    req.id = someId
    logger(req, res)
  }

  setup(t, loggerWithExistingReqId, function (err, server) {
    plan.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    plan.equal(line.req.id, someId)
  })

  await plan
})

test('startTime', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)
  const someStartTime = 56

  assert.equal(typeof pinoHttp.startTime, 'symbol')

  function loggerWithStartTime (req, res) {
    res[pinoHttp.startTime] = someStartTime
    logger(req, res)
    assert.equal(res[pinoHttp.startTime], someStartTime)
  }

  setup(t, loggerWithStartTime, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(typeof line.responseTime, 'number')
    end()
  })
})

test('responseTime', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.ok(line.responseTime >= 0, 'responseTime is defined')
    end()
  })
})

test('responseTime for errored request', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    assert.ok(line.responseTime >= 0, 'responseTime is defined')
    assert.equal(line.msg, DEFAULT_REQUEST_ERROR_MSG, 'message is set')
    end()
  })
})

test('responseTime for request emitting error event', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  function handle (req, res) {
    logger(req, res)
    res.emit('error', new Error('Some error'))
    res.end()
  }

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  }, handle)

  dest.on('data', function (line) {
    assert.ok(line.responseTime >= 0, 'responseTime is defined')
    end()
  })
})

// TODO(mcollina): fix this test
test('log requests aborted during payload', { skip: true }, function (t, end) {
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
    assert.equal(err, undefined)

    const client = net.connect(server.address().port, server.address().address, () => {
      client.write('GET /delayed HTTP/1.1\r\nHost: localhost\r\n\r\n')
    })

    client.on('data', (data) => {
      client.destroy()
    })
  }

  setup(t, logger, listen, handle)

  dest.on('data', function (line) {
    assert.ok(line.responseTime >= 0, 'responseTime is defined')
    assert.equal(line.msg, DEFAULT_REQUEST_ABORTED_MSG, 'message is set')
    end()
  })
})

test('log requests aborted on the server', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp(dest)

  function handle (req, res) {
    logger(req, res)

    req.destroy()
    res.end()
  }

  function listen (err, server) {
    assert.equal(err, undefined)
    const client = doGet(server)

    client.on('error', function () {
      // skip error
    })
  }

  setup(t, logger, listen, handle)

  dest.on('data', function (line) {
    assert.ok(line.responseTime >= 0, 'responseTime is defined')
    assert.equal(line.msg, DEFAULT_REQUEST_ABORTED_MSG, 'message is set')
    end()
  })
})

test('no auto logging with autoLogging set to false', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({ autoLogging: false }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server, null, function () {
      const line = dest.read()
      assert.equal(line, null)
      end()
    })
  })
})

test('autoLogging set to true and path not ignored', (t, end) => {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    autoLogging: {
      ignore: req => req.url === '/ignorethis'
    }
  }, dest)

  setup(test, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server, '/shouldlogthis')
  })

  dest.on('data', function (line) {
    assert.ok('path should log')
    end()
  })
})

test('no auto logging with autoLogging set to true and ignoring a specific user-agent', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    autoLogging: {
      ignore: function (req) {
        return req.headers['user-agent'] === 'ELB-HealthChecker/2.0'
      }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)

    const { address, port } = server.address()
    http.get({
      protocol: 'http:',
      hostname: address,
      port,
      path: '/',
      headers: { 'User-Agent': 'ELB-HealthChecker/2.0' }
    }, function () {
      const line = dest.read()
      assert.equal(line, null)
      end()
    })
  })
})

test('support a custom instance', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest)
  })

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.ok(line.req, 'req is defined')
    assert.ok(line.res, 'res is defined')
    assert.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    assert.equal(line.req.method, 'GET', 'method is get')
    assert.equal(line.res.statusCode, 200, 'statusCode is 200')
    end()
  })
})

test('support a custom instance with custom genReqId function', function (t, end) {
  const dest = split(JSON.parse)

  let idToTest

  function genReqId (req, res) {
    assert.ok(res, 'res is defined')
    assert.ok(req.url, 'The first argument must be the request parameter')
    idToTest = (Date.now() + Math.random()).toString(32)
    return idToTest
  }

  const logger = pinoHttp({
    logger: pino(dest),
    genReqId
  })

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.ok(line.req, 'req is defined')
    assert.ok(line.res, 'res is defined')
    assert.equal(line.genReqId, undefined)
    assert.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG, 'message is set')
    assert.equal(line.req.method, 'GET', 'method is get')
    assert.equal(line.res.statusCode, 200, 'statusCode is 200')
    end()
  })
})

test('support a custom instance with one of its customLevels as useLevel', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.level, 25, 'level')
    assert.equal(line.useLevel, undefined, 'useLevel not forwarded')
    end()
  })
})

test('does not crash when no request connection object', async function (t) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest)
  })
  const plan = tspl(t, { plan: 1 })

  const server = http.createServer(handler)
  server.unref()
  server.listen(9999, () => {
    http.get('http://127.0.0.1:9999', (res) => {
      plan.ok('made it through logic path without crashing')
      server.close()
    })
  })

  await plan

  function handler (req, res) {
    delete req.connection
    logger(req, res)
    res.end()
  }
})

// https://github.com/pinojs/pino-http/issues/42
test('does not return excessively long object', async function (t) {
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
  const plan = tspl(t, { plan: 1 })

  const server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => { server.close() })
  })

  function handler (req, res) {
    logger(req, res)
    res.end()
  }

  dest.on('data', function (obj) {
    plan.equal(Object.keys(obj.req).length, 6)
  })

  await plan
})

test('err.raw is available to custom serializers', async function (t) {
  const plan = tspl(t, { plan: 1 })
  const error = new Error('foo')
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      err (err) {
        plan.equal(err.raw, error)
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
    http.get(server.address(), () => { server.close() })
  })

  await plan
})

test('req.raw is available to custom serializers', async function (t) {
  const plan = tspl(t, { plan: 2 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        plan.ok(req.raw)
        plan.ok(req.raw.connection)
        return req
      }
    }
  })

  const server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => { server.close() })
  })

  await plan

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('res.raw is available to custom serializers', async function (t) {
  const plan = tspl(t, { plan: 2 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      res: function (res) {
        plan.ok(res.raw)
        plan.ok(res.raw.statusCode)
        return res
      }
    }
  })

  const server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => { server.close() })
  })

  await plan

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('res.raw is not enumerable', async function (t) {
  const plan = tspl(t, { plan: 1 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      res: function (res) {
        plan.equal(Object.prototype.propertyIsEnumerable.call(res, 'raw'), false)
        return res
      }
    }
  })

  const server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => { server.close() })
  })

  await plan

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('err.raw, req.raw and res.raw are passed into custom serializers directly, when opts.wrapSerializers is false', async (t) => {
  const plan = tspl(t, { plan: 6 })
  const error = new Error('foo')
  const dest = split(JSON.parse)

  const server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => { server.close() })
  })

  await plan

  function handler (request, response) {
    const logger = pinoHttp({
      logger: pino(dest),
      wrapSerializers: false,
      serializers: {
        err: function (err) {
          plan.equal(err.raw, undefined)
          plan.equal(err, error)
          return err
        },
        req: function (req) {
          plan.equal(req.raw, undefined)
          plan.equal(req, request)
          return req
        },
        res: function (res) {
          plan.equal(res.raw, undefined)
          plan.equal(res, response)
          return res
        }
      }
    })
    logger(request, response)
    response.err = error
    response.end()
  }
})

test('req.id has a non-function value', async function (t) {
  const plan = tspl(t, { plan: 1 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    logger: pino(dest),
    serializers: {
      req: function (req) {
        plan.equal(typeof req.id === 'function', false)
        return req
      }
    }
  })

  const server = http.createServer(handler)
  server.unref()
  server.listen(0, () => {
    http.get(server.address(), () => { server.close() })
  })

  await plan

  function handler (req, res) {
    logger(req, res)
    res.end()
  }
})

test('uses the custom successMessage callback if passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const customResponseMessage = 'Custom response message'
  const logger = pinoHttp({
    customSuccessMessage: function (req, res) {
      return customResponseMessage + ' ' + req.method
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.msg, customResponseMessage + ' GET')
    end()
  })
})

test('pass responseTime argument to the custom successMessage callback', function (t, end) {
  const dest = split(JSON.parse)
  const customResponseMessage = 'Response time is: '
  const logger = pinoHttp({
    customSuccessMessage: function (req, res, responseTime) {
      return customResponseMessage + responseTime + ' ' + req.method
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.match(line.msg, /Response time is: \d+ GET/)
    end()
  })
})

test('pass responseTime argument to the custom errorMessage callback', function (t, end) {
  const dest = split(JSON.parse)
  const customErrorMessage = 'Response time is:'
  const logger = pinoHttp({
    customErrorMessage: function (req, res, err, responseTime) {
      return `${customErrorMessage} ${responseTime} ${req.method}`
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    assert.match(line.msg, /Response time is: \d+ GET/)
    end()
  })
})

test('uses the custom successObject callback if passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customSuccessObject: function (req, res, val) {
      return { ...val, label: req.method + ' customSuccessObject' }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.label, 'GET customSuccessObject')
    end()
  })
})

test('uses the custom receivedMessage callback if passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const message = DEFAULT_REQUEST_RECEIVED_MSG
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return message
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    if (line.msg === DEFAULT_REQUEST_COMPLETED_MSG) {
      return
    }
    assert.equal(line.msg, message)
    end()
  })
})

test('uses the custom receivedObject callback if passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customReceivedObject: function (req, val) {
      return { label: req.method + ' customReceivedObject' }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    if (line.label === undefined) {
      return
    }

    assert.equal(line.label, 'GET customReceivedObject')
    end()
  })
})

test('uses the custom receivedObject + receivedMessage callback if passed in as an option', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    if (line.label === undefined && line.msg !== undefined) {
      return
    }

    assert.equal(line.msg, DEFAULT_REQUEST_RECEIVED_MSG)
    assert.equal(line.label, 'GET customReceivedObject')
    end()
  })
})

test('receive receivedMessage before successMessage', async function (t) {
  const plan = tspl(t, { plan: 3 })
  const dest = split(JSON.parse)
  const message = DEFAULT_REQUEST_RECEIVED_MSG
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return message
    }
  }, dest)

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, null, function () {
      plan.equal(dest.read().msg, DEFAULT_REQUEST_RECEIVED_MSG)
      plan.equal(dest.read().msg, DEFAULT_REQUEST_COMPLETED_MSG)
    })
  })

  await plan
})

test('uses the custom errorMessage callback if passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const customErrorMessage = 'Custom error message'
  const logger = pinoHttp({
    customErrorMessage: function (req, res, err) {
      return customErrorMessage + ' ' + req.method + ' ' + err.toString()
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    assert.equal(line.msg.indexOf(customErrorMessage + ' GET'), 0)
    end()
  })
})

test('uses the custom errorObject callback if passed in as an option', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customErrorObject: function (req, res, err, val) {
      return { ...val, label: 'customErrorObject ' + req.method + ' ' + err.toString() }
    }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    assert.equal(line.label.indexOf('customErrorObject GET'), 0)
    end()
  })
})

test('receive receivedMessage before errorMessage', async function (t) {
  const plan = tspl(t, { plan: 3 })
  const dest = split(JSON.parse)
  const message = DEFAULT_REQUEST_RECEIVED_MSG
  const logger = pinoHttp({
    customReceivedMessage: function (_req, _res) {
      return message
    }
  }, dest)

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, ERROR_URL, function () {
      plan.equal(dest.read().msg, DEFAULT_REQUEST_RECEIVED_MSG)
      plan.equal(dest.read().msg, DEFAULT_REQUEST_ERROR_MSG)
    })
  })

  await plan
})

test('uses custom log object attribute keys when provided, successful request', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.ok(line.httpReq, 'httpReq is defined')
    assert.ok(line.httpRes, 'httpRes is defined')
    assert.equal(typeof line.timeTaken, 'number')
    end()
  })
})

test('uses custom log object attribute keys when provided, error request', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    assert.ok(line.httpReq, 'httpReq is defined')
    assert.ok(line.httpRes, 'httpRes is defined')
    assert.ok(line.httpErr, 'httpRes is defined')
    assert.equal(typeof line.timeTaken, 'number')
    end()
  })
})

test('uses custom request properties to log additional attributes when provided', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.key1, 'value1')
    assert.equal(line.key2, 'value2')
    end()
  })
})

test('uses old custom request properties interface to log additional attributes', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.key1, 'value1')
    assert.equal(line.key2, 'value2')
    end()
  })
})

test('uses custom request properties to log additional attributes when response provided', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server, ERROR_URL)
  })

  dest.on('data', function (line) {
    assert.equal(line.key1, 'value1')
    assert.equal(line.key2, 500)
    end()
  })
})

test('uses custom request properties and a receivedMessage callback and the properties are set on the receivedMessage', function (t, end) {
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
    assert.equal(err, undefined)
    doGet(server, ERROR_URL)
  })

  let calls = 0
  dest.on('data', function (line) {
    calls++
    if (line.msg === message) {
      assert.equal(line.key1, 'value1')
      assert.equal(line.key2, 200)
      assert.equal(line.req.url, ERROR_URL)
      assert.ok(line.req, 'req is defined')
      assert.equal(line.res, undefined, 'res is not defined yet')
    } else if (line.msg === DEFAULT_REQUEST_ERROR_MSG) {
      assert.equal(line.key1, 'value1')
      assert.equal(line.key2, 500)
      assert.equal(line.req.url, ERROR_URL)
      assert.ok(line.req, 'req is defined')
      assert.ok(line.res, 'res is defined')
    }
    if (calls === 2) {
      end()
    }
  })
})

test('uses custom request properties to log additional attributes; custom props is an object instead of callback', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customProps: { key1: 'value1' }
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.key1, 'value1')
    end()
  })
})

test('uses custom request properties and once customProps', function (t, end) {
  const dest = split()

  function customPropsHandler (req, res) {
    return {
      key1: 'value1'
    }
  }

  const logger = pinoHttp({
    customProps: customPropsHandler
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.equal(line.match(/key1/g).length, 1, 'once customProps')
    end()
  })
})

test('dont pass custom request properties to log additional attributes', function (t, end) {
  const dest = split(JSON.parse)
  const logger = pinoHttp({
    customProps: undefined
  }, dest)

  setup(t, logger, function (err, server) {
    assert.equal(err, undefined)
    doGet(server)
  })

  dest.on('data', function (line) {
    assert.ok(line.hostname, 'hostname is defined')
    assert.ok(line.level, 'level is defined')
    assert.ok(line.msg, 'msg is defined')
    assert.ok(line.pid, 'pid is defined')
    assert.ok(line.req, 'req is defined')
    assert.ok(line.res, 'res is defined')
    assert.ok(line.time, 'time is defined')
    end()
  })
})

test('auto logging and next callback', async function (t) {
  const plan = tspl(t, { plan: 3 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({ autoLogging: true }, dest)

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, null, function () {
      const line = dest.read()
      plan.equal(line.msg, DEFAULT_REQUEST_COMPLETED_MSG)
    })
  }, function (req, res) {
    logger(req, res, function () {
      plan.ok('called')
      res.end('hello world')
    })
  })

  await plan
})

test('quiet request logging', async function (t) {
  const plan = tspl(t, { plan: 8 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({ quietReqLogger: true }, dest)

  function handler (req, res) {
    plan.ok('called')
    req.id = 'testId'
    logger(req, res)
    req.log.info('quiet message')
    res.end('hello world')
  }

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, null, function () {
      const quietLine = dest.read()
      plan.equal(quietLine.msg, 'quiet message')
      plan.equal(quietLine.reqId, 'testId')
      plan.equal(quietLine.req, undefined)

      const responseLine = dest.read()
      plan.equal(responseLine.msg, DEFAULT_REQUEST_COMPLETED_MSG)
      plan.equal(responseLine.reqId, 'testId')
      plan.ok(responseLine.req)
    })
  }, handler)

  await plan
})

test('quiet request logging - custom request id key', async function (t) {
  const plan = tspl(t, { plan: 8 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({ quietReqLogger: true, customAttributeKeys: { reqId: 'customRequestId' } }, dest)

  function handler (req, res) {
    plan.ok('called')
    req.id = 'testId'
    logger(req, res)
    req.log.info('quiet message')
    res.end('hello world')
  }

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, null, function () {
      const quietLine = dest.read()
      plan.equal(quietLine.msg, 'quiet message')
      plan.equal(quietLine.req, undefined)
      plan.equal(quietLine.customRequestId, 'testId')

      const responseLine = dest.read()
      plan.equal(responseLine.msg, DEFAULT_REQUEST_COMPLETED_MSG)
      plan.equal(responseLine.customRequestId, 'testId')
      plan.ok(responseLine.req)
    })
  }, handler)

  await plan
})

test('quiet response logging', async function (t) {
  const plan = tspl(t, { plan: 5 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({ quietResLogger: true }, dest)

  function handler (req, res) {
    plan.ok('called')
    req.id = 'testId'
    logger(req, res)
    req.log.info('quiet message')
    res.end('hello world')
  }

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, null, function () {
      dest.read()

      const responseLine = dest.read()
      plan.equal(responseLine.msg, DEFAULT_REQUEST_COMPLETED_MSG)
      plan.equal(responseLine.req, undefined)
      plan.ok(responseLine.res)
    })
  }, handler)

  await plan
})

test('quiet request and response logging', async function (t) {
  const plan = tspl(t, { plan: 6 })
  const dest = split(JSON.parse)
  const logger = pinoHttp({ quietReqLogger: true, quietResLogger: true }, dest)

  function handler (req, res) {
    plan.ok('called')
    req.id = 'testId'
    logger(req, res)
    req.log.info('quiet message')
    res.end('hello world')
  }

  setup(t, logger, function (err, server) {
    plan.equal(err, undefined)
    doGet(server, null, function () {
      dest.read()

      const responseLine = dest.read()
      plan.equal(responseLine.msg, DEFAULT_REQUEST_COMPLETED_MSG)
      plan.equal(responseLine.reqId, 'testId')
      plan.equal(responseLine.req, undefined)
      plan.ok(responseLine.res)
    })
  }, handler)

  await plan
})

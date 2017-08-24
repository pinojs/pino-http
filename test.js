'use strict'

var test = require('tap').test
var http = require('http')
var pinoHttp = require('./')
var pino = require('pino')
var split = require('split2')

function setup (t, logger, cb, handler) {
  var server = http.createServer(handler || function (req, res) {
    logger(req, res)
    if (req.url === '/') {
      res.end('hello world')
      return
    }
    res.statusCode = 404
    res.end('Not Found')
  })

  server.listen(0, '127.0.0.1', function (err) {
    cb(err || null, server)
  })
  t.tearDown(function (cb) {
    server.close(cb)
  })

  return server
}

function doGet (server) {
  var address = server.address()
  return http.get('http://' + address.address + ':' + address.port)
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
    t.notEqual(line.req.id, lastId)
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

  var logger = pinoHttp({genReqId: genReqId}, dest)
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

  function handle (req, res) {
    logger(req, res)
    setTimeout(function () {
      res.end('hello world')
    }, 100)
  }

  expectResponseTime(t, dest, logger, handle)
})

test('responseTime for errored request', function (t) {
  var dest = split(JSON.parse)
  var logger = pinoHttp(dest)

  function handle (req, res) {
    logger(req, res)
    setTimeout(function () {
      res.emit('error', new Error('Some error'))
      res.end()
    }, 100)
  }

  expectResponseTime(t, dest, logger, handle)
})

function expectResponseTime (t, dest, logger, handle) {
  setup(t, logger, function (err, server) {
    t.error(err)
    doGet(server)
  }, handle)

  dest.on('data', function (line) {
    // let's take into account Node v0.10 is less precise
    t.ok(line.responseTime >= 90, 'responseTime is defined and in ms')
    t.end()
  })
}

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

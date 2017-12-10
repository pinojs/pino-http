'use strict'

var pino = require('pino')

var startTime = Symbol('startTime')

function pinoLogger (opts, stream) {
  if (opts && opts._writableState) {
    stream = opts
    opts = null
  }

  opts = opts || {}
  opts.serializers = opts.serializers || {}
  opts.serializers.req = wrapReqSerializer(opts.serializers.req || asReqValue)
  opts.serializers.res = wrapResSerializer(opts.serializers.res || asResValue)
  opts.serializers.err = opts.serializers.err || pino.stdSerializers.err

  var useLevel = opts.useLevel || 'info'
  delete opts.useLevel

  var theStream = opts.stream || stream
  delete opts.stream

  var logger = wrapChild(opts, theStream)
  var genReqId = reqIdGenFactory(opts.genReqId)
  loggingMiddleware.logger = logger
  return loggingMiddleware

  function onResFinished (err) {
    this.removeListener('finish', onResFinished)
    this.removeListener('error', onResFinished)

    var log = this.log
    var responseTime = Date.now() - this[startTime]

    if (err) {
      log.error({
        res: this,
        err: err,
        responseTime: responseTime
      }, 'request errored')
      return
    }

    log[useLevel]({
      res: this,
      responseTime: responseTime
    }, 'request completed')
  }

  function loggingMiddleware (req, res, next) {
    req.id = genReqId(req)
    req.log = res.log = logger.child({req: req})
    res[startTime] = res[startTime] || Date.now()
    if (!req.res) { req.res = res }

    res.on('finish', onResFinished)
    res.on('error', onResFinished)

    if (next) {
      next()
    }
  }
}

var rawSymbol = Symbol.for('pino-raw-ref')
var pinoReqProto = Object.create({}, {
  id: {
    enumerable: true,
    writable: true,
    value: ''
  },
  method: {
    enumerable: true,
    writable: true,
    value: ''
  },
  url: {
    enumerable: true,
    writable: true,
    value: ''
  },
  headers: {
    enumerable: true,
    writable: true,
    value: {}
  },
  remoteAddress: {
    enumerable: true,
    writable: true,
    value: ''
  },
  remotePort: {
    enumerable: true,
    writable: true,
    value: ''
  },
  raw: {
    enumerable: false,
    get: function () {
      return this[rawSymbol]
    },
    set: function (val) {
      this[rawSymbol] = val
    }
  }
})
Object.defineProperty(pinoReqProto, rawSymbol, {
  writable: true,
  value: {}
})

function wrapReqSerializer (serializer) {
  if (serializer === asReqValue) return asReqValue
  return function wrappedReqSerializer (req) {
    return serializer(asReqValue(req))
  }
}

function asReqValue (req) {
  var connection = req.connection
  const _req = Object.create(pinoReqProto)
  _req.id = typeof req.id === 'function' ? req.id() : req.id
  _req.method = req.method
  _req.url = req.url
  _req.headers = req.headers
  _req.remoteAddress = connection && connection.remoteAddress
  _req.remotePort = connection && connection.remotePort
  _req.raw = req
  return _req
}

var pinoResProto = Object.create({}, {
  statusCode: {
    enumerable: true,
    writable: true,
    value: 0
  },
  header: {
    enumerable: true,
    writable: true,
    value: ''
  },
  raw: {
    enumerable: false,
    get: function () {
      return this[rawSymbol]
    },
    set: function (val) {
      this[rawSymbol] = val
    }
  }
})
Object.defineProperty(pinoResProto, rawSymbol, {
  writable: true,
  value: {}
})

function asResValue (res) {
  const _res = Object.create(pinoResProto)
  _res.statusCode = res.statusCode
  _res.header = res._header
  _res.raw = res
  return _res
}

function wrapResSerializer (serializer) {
  if (serializer === asResValue) return asResValue
  return function wrappedResSerializer (res) {
    return serializer(asResValue(res))
  }
}

function wrapChild (opts, stream) {
  var prevLogger = opts.logger
  var prevGenReqId = opts.genReqId
  var logger = null

  if (prevLogger) {
    opts.logger = undefined
    opts.genReqId = undefined
    logger = prevLogger.child(opts)
    opts.logger = prevLogger
    opts.genReqId = prevGenReqId
  } else {
    logger = pino(opts, stream)
  }

  return logger
}

function reqIdGenFactory (func) {
  if (typeof func === 'function') return func
  var maxInt = 2147483647
  var nextReqId = 0
  return function genReqId (req) {
    return req.id || (nextReqId = (nextReqId + 1) & maxInt)
  }
}

module.exports = pinoLogger
module.exports.stdSerializers = {
  req: asReqValue,
  res: asResValue
}
module.exports.startTime = startTime

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
  opts.serializers.req = opts.serializers.req || asReqValue
  opts.serializers.res = opts.serializers.res || pino.stdSerializers.res
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

function asReqValue (req) {
  var connection = req.connection
  return {
    id: req.id,
    method: req.method,
    url: req.url,
    headers: req.headers,
    remoteAddress: connection && connection.remoteAddress,
    remotePort: connection && connection.remotePort
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
  res: pino.stdSerializers.res
}
module.exports.startTime = startTime

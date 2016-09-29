'use strict'

var pino = require('pino')
var id = Symbol('id')

function pinoLogger (opts, stream) {
  if (opts && opts._writableState) {
    stream = opts
    opts = null
  }

  opts = opts || {}
  opts.serializers = opts.serializers || {}
  opts.serializers.req = opts.serializers.req || asReqValue
  opts.serializers.res = opts.serializers.res || pino.stdSerializers.res

  var logger = wrapChild(opts, stream)
  var genReqId = reqIdGenFactory(opts.genReqId)
  loggingMiddleware.logger = logger
  return loggingMiddleware

  function onResFinished (err) {
    this.removeListener('finish', onResFinished)
    this.removeListener('error', onResFinished)

    var log = this.log
    var responseTime = Date.now() - this.startTime

    if (err) {
      log.error({
        res: this,
        err: err,
        responseTime: responseTime
      }, 'request errored')
      return
    }

    log.info({
      res: this,
      responseTime: responseTime
    }, 'request completed')
  }

  function loggingMiddleware (req, res, next) {
    req[id] = genReqId(req)
    req.log = res.log = logger.child({req: req})
    res.startTime = Date.now()

    res.on('finish', onResFinished)
    res.on('error', onResFinished)

    if (next) {
      next()
    }
  }
}

function asReqValue (req) {
  return {
    id: req[id],
    method: req.method,
    url: req.url,
    headers: req.headers,
    remoteAddress: req.connection.remoteAddress,
    remotePort: req.connection.remotePort
  }
}

function wrapChild (opts, stream) {
  var prevLogger = opts.logger
  var logger = null

  if (prevLogger) {
    opts.logger = undefined
    logger = prevLogger.child(opts)
    opts.logger = prevLogger
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
    return req.id || (nextReqId = (nextReqId % maxInt) + 1)
  }
}

module.exports = pinoLogger
module.exports.stdSerializers = {
  req: asReqValue,
  res: pino.stdSerializers.res
}

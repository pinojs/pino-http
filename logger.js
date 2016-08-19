'use strict'

var pino = require('pino')
var maxInt = 2147483647

function pinoLogger (opts, stream) {
  if (opts && opts._writableState) {
    stream = opts
    opts = null
  }

  opts = opts || {}
  opts.serializers = opts.serializers || {}
  opts.serializers.req = opts.serializers.req || asReqValue
  opts.serializers.res = opts.serializers.res || pino.stdSerializers.res

  var logger = null

  if (opts.logger) {
    logger = opts.logger
    opts.logger = undefined
    logger = logger.child(opts)
  } else {
    logger = pino(opts, stream)
  }

  loggingMiddleware.logger = logger

  var nextReqId = 0

  stream = logger.stream

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
    var startTime = Date.now()
    if (req.id === undefined) {
      req.id = ++nextReqId
      nextReqId = nextReqId % maxInt
    }

    var child = logger.child({req: req})

    req.log = child
    res.log = child
    res.startTime = startTime

    res.on('finish', onResFinished)
    res.on('error', onResFinished)

    if (next) {
      next()
    }
  }
}

function asReqValue (req) {
  return {
    id: req.id,
    method: req.method,
    url: req.url,
    headers: req.headers,
    remoteAddress: req.connection.remoteAddress,
    remotePort: req.connection.remotePort
  }
}

module.exports = pinoLogger
module.exports.stdSerializers = {
  req: asReqValue,
  res: pino.stdSerializers.res
}

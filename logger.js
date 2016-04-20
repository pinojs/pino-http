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

  var logger = pino(opts, stream)

  loggingMiddleware.logger = logger

  var nextId = 0

  stream = logger.stream

  return loggingMiddleware

  function onResFinished (err) {
    this.removeListener('finish', onResFinished)
    this.removeListener('error', onResFinished)

    var end = process.hrtime(this.startTime)
    var log = this.log
    var responseTime = Math.round(end[0] * 1e3 + end[1] / 1e6)

    if (err) {
      log.error({
        res: this,
        err: err,
        responseTime: this.responseTime
      }, 'request errored')
      return
    }

    log.info({
      res: this,
      responseTime: responseTime
    }, 'request completed')
  }

  function loggingMiddleware (req, res, next) {
    var startTime = process.hrtime()
    req.id = ++nextId
    nextId = nextId % maxInt

    var child = logger.child({ req: req })

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

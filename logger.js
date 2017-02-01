'use strict'

var pino = require('pino')

function pinoLogger (opts, stream) {
  if (opts && opts._writableState) {
    stream = opts
    opts = null
  }

  opts = opts || {}
  opts.serializers = opts.serializers || {}
  opts.serializers.req = opts.serializers.req || asReqValue
  opts.serializers.res = opts.serializers.res || pino.stdSerializers.res

  var useLevel = opts.useLevel || 'info'
  delete opts.useLevel

  var theStream = opts.stream || stream
  delete opts.stream

  var logger = wrapChild(opts, theStream)
  var genReqId = reqIdGenFactory(opts.genReqId)
  loggingMiddleware.logger = logger
  return loggingMiddleware

  function onResFinished (err, msg) {
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

    log[useLevel]({
      res: this,
      responseTime: responseTime
    }, 'request ' + (msg || 'completed'))
  }

  function onReqAborted () {
    var res = this.res
    onResFinished.call(res, null, 'aborted')
  }

  function onReqTimeout () {
    this.removeListener('aborted', onReqAborted)

    var res = this.res
    res.statusCode = 408
    onResFinished.call(res, new Error('Timeout'))
  }

  function loggingMiddleware (req, res, next) {
    req.id = genReqId(req)
    req.log = res.log = logger.child({req: req})
    res.startTime = Date.now()
    if (!req.res) { req.res = res }

    res.on('finish', onResFinished)
    res.on('error', onResFinished)
    req.on('aborted', onReqAborted)
    req.socket.on('timeout', onReqTimeout.bind(req))

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

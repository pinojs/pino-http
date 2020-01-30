'use strict'

var pino = require('pino')
var serializers = require('pino-std-serializers')
var URL = require('fast-url-parser')
var startTime = Symbol('startTime')

function pinoLogger (opts, stream) {
  if (opts && opts._writableState) {
    stream = opts
    opts = null
  }

  opts = opts || {}
  opts.serializers = opts.serializers || {}
  opts.serializers.req = serializers.wrapRequestSerializer(opts.serializers.req || serializers.req)
  opts.serializers.res = serializers.wrapResponseSerializer(opts.serializers.res || serializers.res)
  opts.serializers.err = serializers.wrapErrorSerializer(opts.serializers.err || serializers.err)

  if (opts.useLevel && opts.customLogLevel) {
    throw new Error("You can't pass 'useLevel' and 'customLogLevel' together")
  }

  var useLevel = opts.useLevel || 'info'
  var customLogLevel = opts.customLogLevel
  delete opts.useLevel
  delete opts.customLogLevel

  var theStream = opts.stream || stream
  delete opts.stream

  var autoLogging = (opts.autoLogging !== false)
  var autoLoggingIgnorePaths = (opts.autoLogging && opts.autoLogging.ignorePaths) ? opts.autoLogging.ignorePaths : []
  delete opts.autoLogging

  var logger = wrapChild(opts, theStream)
  var genReqId = reqIdGenFactory(opts.genReqId)
  loggingMiddleware.logger = logger
  return loggingMiddleware

  function onResFinished (err) {
    this.removeListener('error', onResFinished)
    this.removeListener('finish', onResFinished)

    var log = this.log
    var responseTime = Date.now() - this[startTime]
    var level = customLogLevel ? customLogLevel(this, err) : useLevel

    if (err || this.err || this.statusCode >= 500) {
      log[level]({
        res: this,
        err: err || this.err || new Error('failed with status code ' + this.statusCode),
        responseTime: responseTime
      }, 'request errored')
      return
    }

    log[level]({
      res: this,
      responseTime: responseTime
    }, 'request completed')
  }

  function loggingMiddleware (req, res, next) {
    var shouldLogSuccess = true

    req.id = genReqId(req)
    req.log = res.log = logger.child({req: req})
    res[startTime] = res[startTime] || Date.now()

    if (autoLogging) {
      if (req.url && autoLoggingIgnorePaths.length) {
        var url = URL.parse(req.url)
        shouldLogSuccess = !autoLoggingIgnorePaths.includes(url.pathname)
      }

      if (shouldLogSuccess) {
        res.on('finish', onResFinished)
      }

      res.on('error', onResFinished)
    }

    if (next) {
      next()
    }
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
  err: serializers.err,
  req: serializers.req,
  res: serializers.res
}
module.exports.startTime = startTime

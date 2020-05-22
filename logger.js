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

  opts = Object.assign({}, opts)

  opts.customAttributeKeys = opts.customAttributeKeys || {}
  var reqKey = opts.customAttributeKeys.req || 'req'
  var resKey = opts.customAttributeKeys.res || 'res'
  var errKey = opts.customAttributeKeys.err || 'err'
  var responseTimeKey = opts.customAttributeKeys.responseTime || 'responseTime'
  delete opts.customAttributeKeys

  var reqCustomProps = opts.reqCustomProps || {}

  opts.wrapSerializers = 'wrapSerializers' in opts ? opts.wrapSerializers : true
  if (opts.wrapSerializers) {
    opts.serializers = Object.assign({}, opts.serializers)
    var requestSerializer = opts.serializers[reqKey] || opts.serializers.req || serializers.req
    var responseSerializer = opts.serializers[resKey] || opts.serializers.res || serializers.res
    var errorSerializer = opts.serializers[errKey] || opts.serializers.err || serializers.err
    opts.serializers[reqKey] = serializers.wrapRequestSerializer(requestSerializer)
    opts.serializers[resKey] = serializers.wrapResponseSerializer(responseSerializer)
    opts.serializers[errKey] = serializers.wrapErrorSerializer(errorSerializer)
  }
  delete opts.wrapSerializers

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
  var autoLoggingGetPath = opts.autoLogging && opts.autoLogging.getPath ? opts.autoLogging.getPath : null
  delete opts.autoLogging

  var successMessage = opts.customSuccessMessage || function () { return 'request completed' }
  var errorMessage = opts.customErrorMessage || function () { return 'request errored' }
  delete opts.customSuccessfulMessage
  delete opts.customErroredMessage

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
      var error = err || this.err || new Error('failed with status code ' + this.statusCode)

      log[level]({
        [resKey]: this,
        [errKey]: error,
        [responseTimeKey]: responseTime
      }, errorMessage(error, this))
      return
    }

    log[level]({
      [resKey]: this,
      [responseTimeKey]: responseTime
    }, successMessage(this))
  }

  function loggingMiddleware (req, res, next) {
    var shouldLogSuccess = true

    req.id = genReqId(req)

    var log = logger.child({ [reqKey]: req })

    if (reqCustomProps) {
      var customPropBindings = (typeof reqCustomProps === 'function') ? reqCustomProps(req) : reqCustomProps
      log = log.child(customPropBindings)
    }
    req.log = res.log = log

    res[startTime] = res[startTime] || Date.now()

    if (autoLogging) {
      if (autoLoggingIgnorePaths.length) {
        var url
        if (autoLoggingGetPath) {
          url = URL.parse(autoLoggingGetPath(req))
        } else if (req.url) {
          url = URL.parse(req.url)
        }
        if (url && url.pathname) {
          shouldLogSuccess = !autoLoggingIgnorePaths.includes(url.pathname)
        }
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

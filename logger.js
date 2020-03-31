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

  opts.customAttributeKeys = opts.customAttributeKeys || {}
  var attributeKeys = {
    req: opts.customAttributeKeys.req || 'req',
    res: opts.customAttributeKeys.res || 'res',
    err: opts.customAttributeKeys.err || 'err',
    responseTime: opts.customAttributeKeys.responseTime || 'responseTime'
  }
  delete opts.customAttributeKeys

  opts.serializers = opts.serializers || {}
  var requestSerializer = opts.serializers[attributeKeys.req] || opts.serializers.req || serializers.req
  var responseSerializer = opts.serializers[attributeKeys.res] || opts.serializers.res || serializers.res
  var errorSerializer = opts.serializers[attributeKeys.err] || opts.serializers.err || serializers.err
  opts.serializers[attributeKeys.req] = serializers.wrapRequestSerializer(requestSerializer)
  opts.serializers[attributeKeys.res] = serializers.wrapResponseSerializer(responseSerializer)
  opts.serializers[attributeKeys.err] = serializers.wrapErrorSerializer(errorSerializer)

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
  var errorMessage = opts.customErrorMessage || function () { return 'request errored ' }
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
    var payload = {}

    payload[attributeKeys.res] = this
    payload[attributeKeys.responseTime] = responseTime

    if (err || this.err || this.statusCode >= 500) {
      var error = err || this.err || new Error('failed with status code ' + this.statusCode)
      payload[attributeKeys.err] = error

      log[level](payload, errorMessage(error, this))
      return
    }

    log[level](payload, successMessage(this))
  }

  function loggingMiddleware (req, res, next) {
    var shouldLogSuccess = true

    req.id = genReqId(req)

    var childPayload = {}
    childPayload[attributeKeys.req] = req

    req.log = res.log = logger.child(childPayload)
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

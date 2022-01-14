'use strict'

const pino = require('pino')
const serializers = require('pino-std-serializers')
const getCallerFile = require('get-caller-file')
const URL = require('fast-url-parser')
const startTime = Symbol('startTime')
const reqObject = Symbol('reqObject')

function pinoLogger (opts, stream) {
  if (opts && opts._writableState) {
    stream = opts
    opts = null
  }

  opts = Object.assign({}, opts)

  opts.customAttributeKeys = opts.customAttributeKeys || {}
  const reqKey = opts.customAttributeKeys.req || 'req'
  const resKey = opts.customAttributeKeys.res || 'res'
  const errKey = opts.customAttributeKeys.err || 'err'
  const requestIdKey = opts.customAttributeKeys.reqId || 'reqId'
  const responseTimeKey = opts.customAttributeKeys.responseTime || 'responseTime'
  delete opts.customAttributeKeys

  const customProps = opts.customProps || opts.reqCustomProps || undefined

  opts.wrapSerializers = 'wrapSerializers' in opts ? opts.wrapSerializers : true
  if (opts.wrapSerializers) {
    opts.serializers = Object.assign({}, opts.serializers)
    const requestSerializer = opts.serializers[reqKey] || opts.serializers.req || serializers.req
    const responseSerializer = opts.serializers[resKey] || opts.serializers.res || serializers.res
    const errorSerializer = opts.serializers[errKey] || opts.serializers.err || serializers.err
    opts.serializers[reqKey] = serializers.wrapRequestSerializer(requestSerializer)
    opts.serializers[resKey] = serializers.wrapResponseSerializer(responseSerializer)
    opts.serializers[errKey] = serializers.wrapErrorSerializer(errorSerializer)
  }
  delete opts.wrapSerializers

  if (opts.useLevel && opts.customLogLevel) {
    throw new Error("You can't pass 'useLevel' and 'customLogLevel' together")
  }

  const LOG_LEVEL_STRS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']
  function getValidLogLevel (level, defaultValue = 'info') {
    if (level && typeof level === 'string') {
      const logLevel = level.trim().toLowerCase()
      if (LOG_LEVEL_STRS.includes(logLevel) === true) {
        return logLevel
      }
    }
    return defaultValue
  }

  function getLogLevelFromCustomLogLevel (customLogLevel, useLevel, res, err, req) {
    return customLogLevel ? getValidLogLevel(customLogLevel(res, err, req), useLevel) : useLevel
  }

  const useLevel = getValidLogLevel(opts.useLevel)
  const customLogLevel = opts.customLogLevel
  delete opts.useLevel
  delete opts.customLogLevel

  const theStream = opts.stream || stream
  delete opts.stream

  const autoLogging = (opts.autoLogging !== false)
  const autoLoggingIgnore = opts.autoLogging && opts.autoLogging.ignore ? opts.autoLogging.ignore : null
  const autoLoggingIgnorePaths = (opts.autoLogging && opts.autoLogging.ignorePaths) ? opts.autoLogging.ignorePaths : []
  const autoLoggingGetPath = opts.autoLogging && opts.autoLogging.getPath ? opts.autoLogging.getPath : null
  delete opts.autoLogging

  const receivedMessage = opts.customReceivedMessage && typeof opts.customReceivedMessage === 'function' ? opts.customReceivedMessage : undefined
  const successMessage = opts.customSuccessMessage || function () { return 'request completed' }
  const errorMessage = opts.customErrorMessage || function () { return 'request errored' }
  delete opts.customSuccessfulMessage
  delete opts.customErroredMessage

  const quietReqLogger = !!opts.quietReqLogger

  const logger = wrapChild(opts, theStream)
  const genReqId = reqIdGenFactory(opts.genReqId)
  loggingMiddleware.logger = logger
  return loggingMiddleware

  function onResFinished (err) {
    this.removeListener('error', onResFinished)
    this.removeListener('finish', onResFinished)

    let log = this.log
    const responseTime = Date.now() - this[startTime]
    const level = getLogLevelFromCustomLogLevel(customLogLevel, useLevel, this, err)

    if (level === 'silent') {
      return
    }

    const req = this[reqObject]
    const res = this

    const customPropBindings = (typeof customProps === 'function') ? customProps(req, res) : customProps
    if (customPropBindings) {
      log = this.log.child(customPropBindings)
    }

    if (err || this.err || this.statusCode >= 500) {
      const error = err || this.err || new Error('failed with status code ' + this.statusCode)

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
    let shouldLogSuccess = true

    req.id = genReqId(req)

    const log = quietReqLogger ? logger.child({ [requestIdKey]: req.id }) : logger

    let fullReqLogger = log.child({ [reqKey]: req })
    const customPropBindings = (typeof customProps === 'function') ? customProps(req, res) : customProps
    if (customPropBindings) {
      fullReqLogger = fullReqLogger.child(customPropBindings)
    }

    res.log = fullReqLogger
    req.log = quietReqLogger ? log : fullReqLogger

    res[startTime] = res[startTime] || Date.now()
    // carry request to be executed when response is finished
    res[reqObject] = req

    if (autoLogging) {
      if (autoLoggingIgnorePaths.length) {
        let url
        if (autoLoggingGetPath) {
          url = URL.parse(autoLoggingGetPath(req))
        } else {
          url = URL.parse(req.url)
        }

        const isPathIgnored = autoLoggingIgnorePaths.find(ignorePath => {
          if (ignorePath instanceof RegExp) {
            return ignorePath.test(url.pathname)
          }

          return ignorePath === url.pathname
        })

        shouldLogSuccess = !isPathIgnored
      }

      if (autoLoggingIgnore !== null && shouldLogSuccess === true) {
        const isIgnored = autoLoggingIgnore !== null && autoLoggingIgnore(req)
        shouldLogSuccess = !isIgnored
      }

      if (shouldLogSuccess) {
        if (receivedMessage !== undefined) {
          const level = getLogLevelFromCustomLogLevel(customLogLevel, useLevel, res, undefined, req)
          req.log[level](receivedMessage(req, res))
        }

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
  const prevLogger = opts.logger
  const prevGenReqId = opts.genReqId
  let logger = null

  if (prevLogger) {
    opts.logger = undefined
    opts.genReqId = undefined
    logger = prevLogger.child({}, opts)
    opts.logger = prevLogger
    opts.genReqId = prevGenReqId
  } else {
    if (opts.transport && !opts.transport.caller) {
      opts.transport.caller = getCallerFile()
    }

    logger = pino(opts, stream)
  }

  return logger
}

function reqIdGenFactory (func) {
  if (typeof func === 'function') return func
  const maxInt = 2147483647
  let nextReqId = 0
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
module.exports.default = pinoLogger
module.exports.pinoHttp = pinoLogger

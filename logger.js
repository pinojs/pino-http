'use strict'

const pino = require('pino')
const serializers = require('pino-std-serializers')
const getCallerFile = require('get-caller-file')
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

  const customProps = opts.customProps || undefined

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
    throw new Error('You can\'t pass \'useLevel\' and \'customLogLevel\' together')
  }

  function getValidLogLevel (level, defaultValue = 'info') {
    if (level && typeof level === 'string') {
      const logLevel = level.trim().toLowerCase()
      if (validLogLevels.includes(logLevel) === true) {
        return logLevel
      }
    }
    return defaultValue
  }

  function getLogLevelFromCustomLogLevel (customLogLevel, useLevel, res, err, req) {
    return customLogLevel ? getValidLogLevel(customLogLevel(req, res, err), useLevel) : useLevel
  }

  const customLogLevel = opts.customLogLevel
  delete opts.customLogLevel

  const theStream = opts.stream || stream
  delete opts.stream

  const autoLogging = (opts.autoLogging !== false)
  const autoLoggingIgnore = opts.autoLogging && opts.autoLogging.ignore ? opts.autoLogging.ignore : null
  delete opts.autoLogging

  const onRequestReceivedObject = getFunctionOrDefault(opts.customReceivedObject, undefined)
  const receivedMessage = getFunctionOrDefault(opts.customReceivedMessage, undefined)

  const onRequestSuccessObject = getFunctionOrDefault(opts.customSuccessObject, defaultSuccessfulRequestObjectProvider)
  const successMessage = getFunctionOrDefault(opts.customSuccessMessage, defaultSuccessfulRequestMessageProvider)

  const onRequestErrorObject = getFunctionOrDefault(opts.customErrorObject, defaultFailedRequestObjectProvider)
  const errorMessage = getFunctionOrDefault(opts.customErrorMessage, defaultFailedRequestMessageProvider)

  delete opts.customSuccessfulMessage
  delete opts.customErroredMessage

  const quietReqLogger = !!opts.quietReqLogger

  const logger = wrapChild(opts, theStream)

  const validLogLevels = Object.keys(logger.levels.values).concat('silent')
  const useLevel = getValidLogLevel(opts.useLevel)
  delete opts.useLevel

  const genReqId = reqIdGenFactory(opts.genReqId)
  const result = (req, res, next) => {
    return loggingMiddleware(logger, req, res, next)
  }
  result.logger = logger
  return result

  function onResFinished (res, logger, err) {
    let log = logger
    const responseTime = Date.now() - res[startTime]
    const level = getLogLevelFromCustomLogLevel(customLogLevel, useLevel, res, err)

    if (level === 'silent') {
      return
    }

    const req = res[reqObject]

    const customPropBindings = (typeof customProps === 'function') ? customProps(req, res) : customProps
    if (customPropBindings) {
      log = logger.child(customPropBindings)
    }

    if (err || res.err || res.statusCode >= 500) {
      const error = err || res.err || new Error('failed with status code ' + res.statusCode)

      log[level](
        onRequestErrorObject(req, res, error, {
          [resKey]: res,
          [errKey]: error,
          [responseTimeKey]: responseTime
        }),
        errorMessage(req, res, error)
      )

      return
    }

    log[level](
      onRequestSuccessObject(req, res, {
        [resKey]: res,
        [responseTimeKey]: responseTime
      }),
      successMessage(req, res, responseTime)
    )
  }

  function loggingMiddleware (logger, req, res, next) {
    let shouldLogSuccess = true

    req.id = req.id || genReqId(req, res)

    const log = quietReqLogger ? logger.child({ [requestIdKey]: req.id }) : logger

    let fullReqLogger = log.child({ [reqKey]: req })
    const customPropBindings = (typeof customProps === 'function') ? customProps(req, res) : customProps
    if (customPropBindings) {
      fullReqLogger = fullReqLogger.child(customPropBindings)
    }

    const responseLogger = fullReqLogger
    const requestLogger = quietReqLogger ? log : fullReqLogger

    if (!res.log) {
      res.log = responseLogger
    }
    if (!res.allLogs) {
      res.allLogs = []
    }
    res.allLogs.push(responseLogger)

    if (!req.log) {
      req.log = requestLogger
    }
    if (!req.allLogs) {
      req.allLogs = []
    }
    req.allLogs.push(requestLogger)

    res[startTime] = res[startTime] || Date.now()
    // carry request to be executed when response is finished
    res[reqObject] = req

    const onResponseComplete = (err) => {
      res.removeListener('close', onResponseComplete)
      res.removeListener('finish', onResponseComplete)
      res.removeListener('error', onResponseComplete)
      return onResFinished(res, responseLogger, err)
    }

    if (autoLogging) {
      if (autoLoggingIgnore !== null && shouldLogSuccess === true) {
        const isIgnored = autoLoggingIgnore(req)
        shouldLogSuccess = !isIgnored
      }

      if (shouldLogSuccess) {
        const shouldLogReceived = receivedMessage !== undefined || onRequestReceivedObject !== undefined

        if (shouldLogReceived) {
          const level = getLogLevelFromCustomLogLevel(customLogLevel, useLevel, res, undefined, req)
          const receivedObjectResult = onRequestReceivedObject !== undefined ? onRequestReceivedObject(req, res, undefined) : {}
          const receivedStringResult = receivedMessage !== undefined ? receivedMessage(req, res) : undefined

          requestLogger[level](receivedObjectResult, receivedStringResult)
        }

        res.on('close', onResponseComplete)
        res.on('finish', onResponseComplete)
      }

      res.on('error', onResponseComplete)
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
  return function genReqId (req, res) {
    return req.id || (nextReqId = (nextReqId + 1) & maxInt)
  }
}

function getFunctionOrDefault (value, defaultValue) {
  if (value && typeof value === 'function') {
    return value
  }

  return defaultValue
}

function defaultSuccessfulRequestObjectProvider (req, res, successObject) {
  return successObject
}

function defaultFailedRequestObjectProvider (req, res, error, errorObject) {
  return errorObject
}

function defaultFailedRequestMessageProvider () {
  return 'request errored'
}

function defaultSuccessfulRequestMessageProvider (req, res) {
  return res.writableEnded ? 'request completed' : 'request aborted'
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

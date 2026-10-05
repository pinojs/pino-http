'use strict'

const warning = require('process-warning')()

// Warning example
// const warnName = 'PinoHttpWarning'
// warning.create(warnName, 'PINOHTTP_DEP001', 'Use of "autoLogging.ignorePaths" is deprecated since version 7.1.0, use "opts.autoLogging.ignore" instead.')
// warning.create(warnName, 'PINOHTTP_DEP002', 'Use of "autoLogging.getPath" is deprecated since version 7.1.0, use "opts.autoLogging.ignore" instead.')

module.exports = warning

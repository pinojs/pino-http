'use strict'

const http = require('http')
const server = http.createServer(handle)

const logger = require('./')({
  quietReqLogger: true,
  transport: {
    target: 'pino-http-print',
    options: {
      destination: 1,
      all: true,
      colorize: false,
      translateTime: true
    }
  }
})

function handle (req, res) {
  logger(req, res)
  res.end('hello world')
}

server.listen(3000)

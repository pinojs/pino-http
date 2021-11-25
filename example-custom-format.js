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

server.listen(0, '127.0.0.1', (err) => {
  // istanbul ignore next
  if (err) {
    process.exit(1)
  }

  const url = `http://${server.address().address}:${server.address().port}/`
  process.stderr.write(url)
})

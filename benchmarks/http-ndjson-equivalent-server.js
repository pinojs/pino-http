'use strict'

const http = require('http')
const httpNdjson = require('http-ndjson')
const server = http.createServer(handle)

const pid = process.pid
const hostname = require('os').hostname()

function handle (req, res) {
  res.end('hello world')
  const opts = {
    pid: pid,
    hostname: hostname,
    level: 30,
    res: {
      statusCode: res.statusCode,
      header: res._header
    },
    req: {
      method: req.method,
      url: req.url,
      headers: req.headers,
      remoteAddress: req.connection.remoteAddress,
      remotePort: req.connection.remotePort
    }
  }
  httpNdjson(req, res, opts, console.log)
}

server.listen(3000)

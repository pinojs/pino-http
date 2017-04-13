'use strict'

var http = require('http')
var httpNdjson = require('http-ndjson')
var server = http.createServer(handle)

var pid = process.pid
var hostname = require('os').hostname()

function handle (req, res) {
  res.end('hello world')
  var opts = {
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

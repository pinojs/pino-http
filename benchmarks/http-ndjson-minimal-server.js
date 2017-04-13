'use strict'

var http = require('http')
var httpNdjson = require('http-ndjson')
var server = http.createServer(handle)

function handle (req, res) {
  res.end('hello world')

  httpNdjson(req, res, console.log)
}

server.listen(3000)

'use strict'

var http = require('http')
var httpNdjson = require('http-ndjson')
var server = http.createServer(handle)

var logger = require('morgan')('combined')
var pid = process.pid
var hostname = require('os').hostname()

function handle (req, res) {

  res.end('hello world')

  httpNdjson(req, res, console.log)
}

server.listen(3000)


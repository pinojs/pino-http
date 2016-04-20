'use strict'

var http = require('http')
var server = http.createServer(handle)

var logger = require('../')({
  extreme: true
})

function handle (req, res) {
  logger(req, res)
  res.end('hello world')
}

server.listen(3000)

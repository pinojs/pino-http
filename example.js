'use strict'

var http = require('http')
var server = http.createServer(handle)

var logger = require('./')()

function handle (req, res) {
  logger(req, res)
  req.log.info('something else')
  res.end('hello world')
}

server.listen(3000)

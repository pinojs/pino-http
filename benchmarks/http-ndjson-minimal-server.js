'use strict'

const http = require('http')
const httpNdjson = require('http-ndjson')
const server = http.createServer(handle)

function handle (req, res) {
  res.end('hello world')

  httpNdjson(req, res, console.log)
}

server.listen(3000)

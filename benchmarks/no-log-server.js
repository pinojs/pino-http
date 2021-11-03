'use strict'

const http = require('http')
const server = http.createServer(handle)

function handle (req, res) {
  res.end('hello world')
}

server.listen(3000)

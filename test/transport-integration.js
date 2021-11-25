'use strict'

const test = require('tap').test
const http = require('http')
const { join } = require('path')

const { spawn } = require('child_process')

test('custom format transport', function (t) {
  t.plan(2)

  const ls = spawn('node', [join(__dirname, '../example-custom-format.js')], {
    cwd: process.cwd()
  })
  ls.stdout.setEncoding('utf8')
  ls.stderr.setEncoding('utf8')

  ls.stdout.on('data', (data) => {
    t.match(data.trim(), /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \+\d{4}\] GET http:\/\/.+:\d{4,6}\/ 200 \d{1,2}ms/)
    ls.kill()
  })

  ls.stderr.on('data', (url) => {
    t.ok(url.startsWith('http://'))
    http.get(url, () => {})
      .on('error', (e) => { t.error(e) })
  })
})

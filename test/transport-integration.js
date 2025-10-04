'use strict'

const test = require('node:test')
const http = require('node:http')
const { join } = require('node:path')
const { spawn } = require('node:child_process')
const tspl = require('@matteo.collina/tspl')

test('custom format transport', async function (t) {
  const plan = tspl(t, { plan: 2 })

  const ls = spawn('node', [join(__dirname, '../example-custom-format.js')], {
    cwd: process.cwd()
  })
  ls.stdout.setEncoding('utf8')
  ls.stderr.setEncoding('utf8')

  ls.stdout.on('data', (data) => {
    plan.match(data.trim(), /\[\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d{3} \+\d{4}\] GET http:\/\/.+:\d{4,6}\/ 200 \d{1,2}ms/)
    ls.kill()
  })

  ls.stderr.on('data', (url) => {
    plan.ok(url.startsWith('http://'))
    http.get(url, () => {})
      .on('error', (e) => { t.error(e) })
  })

  await plan
})

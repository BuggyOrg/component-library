/* global describe, it */

var expect = require('chai').expect
var api = require('../src/api.js')
import {readFileSync} from 'fs'

describe('Component Library', function () {
  it('getAllMetaPaths', function () {
    var allMetaPaths = api.getAllMetaPaths('./test/fixtures/meta')
    expect(allMetaPaths).to.deep.equal([ 'test/fixtures/meta/io/stdin.json',
                                         'test/fixtures/meta/io/stdout.json',
                                         'test/fixtures/meta/math/inc.json' ])
  })

  it('getMetaFromPath', function () {
    var meta = api.getMetaFromPath('./meta/io/stdin.json')
    expect(meta).to.deep.equal({name: 'STDIN',
                                id: 'io/stdin',
                                inputPorts: { },
                                outputPorts: { output: 'string' },
                                atomic: true,
                                meta: { golang: { needsWaitGroup: true } },
                                implementation: { golang: './golang/io/stdinProcess.go' },
                                dependencies: { golang: [ 'fmt', 'sync' ] } })
  })

  it('getComponentLibrary', function () {
    var compLib = api.getComponentLibrary()
    expect(compLib['io/stdin']).to.deep.equal({ name: 'STDIN',
                                                id: 'io/stdin',
                                                inputPorts: { },
                                                outputPorts: { output: 'string' },
                                                atomic: true,
                                                meta: { golang: { needsWaitGroup: true } },
                                                implementation: { golang: './golang/io/stdinProcess.go' },
                                                dependencies: { golang: [ 'fmt', 'sync' ] } })
  })

  it('getCode', function () {
    var compLib = api.getComponentLibrary()
    var code = api.getCode('io/stdin', 'golang', compLib)
    expect(code).to.deep.equal(readFileSync('./golang/io/stdinProcess.go', 'utf8'))
  })
})

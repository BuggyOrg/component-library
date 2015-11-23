/* global describe, it */

var expect = require('chai').expect
var api = require('../src/api.js')
import {readFileSync} from 'fs'

describe('Component Library', function () {
  it('getAllMetaPaths', function () {
    var allMetaPaths = api.getAllMetaPaths()
    expect(allMetaPaths).to.deep.equal([ './meta/io/stdin.json',
                                            './meta/io/stdout.json',
                                            './meta/math/add.json',
                                            './meta/translator/int_to_string.json',
                                            './meta/translator/string_to_int.json' ])

    // expect(allProcessNames).to.deep.equal([ 'STDIN', 'STDOUT', 'ADD', 'int_to_string', 'string_to_int' ])
  })

  it('getMetaFromPath', function () {
    var meta = api.getMetaFromPath('./meta/io/stdin.json')
    expect(meta).to.deep.equal({name: 'STDIN',
                                id: 'io/stdin',
                                inputPorts: [], outputPorts: [ 'output' ],
                                atomic: true,
                                meta: { golang: { needsWaitGroup: true } },
                                implementation: { golang: './golang/io/stdinProcess.go' },
                                dependencies: { golang: [ 'fmt', 'sync' ] } })
  })

  it('getComponentLibrary', function () {
    var compLib = api.getComponentLibrary()
    expect(compLib['io/stdin']).to.deep.equal({name: 'STDIN',
                                id: 'io/stdin',
                                inputPorts: [], outputPorts: [ 'output' ],
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

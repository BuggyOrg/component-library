/* global describe, it, beforeEach, process */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import connect from '../src/api'
import {exec} from 'child_process'
import allWaiting from './allWaiting'

chai.use(chaiAsPromised)
var expect = chai.expect

process.env.BUGGY_COMPONENT_LIBRARY_HOST = 'http://localhost:9200'

describe('Component library CLI', () => {
  var test = {client: null}
  beforeEach(function () {
    this.timeout(10000)
    test.prefix = 'cli' + Math.ceil(Math.random() * 999)
    test.client = connect('localhost:9200', test.prefix)
    return test.client.init().then(test.client.clear)
  })

  const runCLI = (args, data) => {
    return new Promise((resolve, reject) => {
      var cli = exec('node lib/cli -s -p ' + test.prefix + ' ' + args,
        (error, stdout, stderr) => {
          if (error) {
            reject(stderr)
          } else {
            resolve(stdout)
          }
        }
      )
      if (data) {
        if (typeof data !== 'string') {
          data = JSON.stringify(data)
        }
        cli.stdin.write(data)
      }
      cli.stdin.end()
    })
  }

  it('insert new nodes', () => {
    return expect(runCLI('insert', {
      id: 'test/node',
      version: '0.0.1'
    })).to.be.fulfilled
  })

  it('can get a node', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(() => {
      return runCLI('get test/node 0.0.1')
    })
    .then(stdout => {
      var node = JSON.parse(stdout)
      expect(node.id).to.equal('test/node')
      expect(node.version).to.equal('0.0.1')
    })
  })

  it('gets the node with the highest version it the version is omitted', () => {
    return allWaiting([
      test.client.insert({
        id: 'test/node',
        version: '0.0.2'
      }),
      test.client.insert({
        id: 'test/node',
        version: '0.0.1'
      })
    ])
    .then(test.client.flush)
    .then(() => {
      return runCLI('get test/node')
    })
    .then(stdout => {
      var node = JSON.parse(stdout)
      expect(node.id).to.equal('test/node')
      expect(node.version).to.equal('0.0.2')
    })
  })

  it('sets code for a specific node in a language', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => runCLI('set-code test/node golang', 'a <- b'))
    .then(() => test.client.getCode('test/node', '0.0.1', 'golang'))
    .then(code => {
      expect(code).to.equal('a <- b')
    })
  })

  it('gets code for a specific node in a language', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => test.client.setCode('test/node', '0.0.1', 'golang', 'a <- b'))
    .then(() => runCLI('get-code test/node golang'))
    .then(code => {
      expect(code).to.equal('a <- b\n')
    })
  })

  it('sets code for a specific node in a language', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => runCLI('set-code test/node golang', 'a <- b'))
    .then(() => test.client.getCode('test/node', '0.0.1', 'golang'))
    .then(code => {
      expect(code).to.equal('a <- b')
    })
  })

  it('gets code for a specific node in a language', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => test.client.setCode('test/node', '0.0.1', 'golang', 'a <- b'))
    .then(() => runCLI('get-code test/node golang'))
    .then(code => {
      expect(code).to.equal('a <- b\n')
    })
  })

  it('sets metadata for a specific node', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => runCLI('set-meta test/node dummy', '{"a":1,"b":2}'))
    .then(test.client.flush)
    .then(() => test.client.getMeta('test/node', '0.0.1', 'dummy'))
    .then(data => {
      expect(data).to.deep.equal({'a': 1, 'b': 2})
    })
  })

  it('gets metadata for a specific node', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => test.client.setMeta('test/node', '0.0.1', 'dummy', {'a': 1, 'b': 2}))
    .then(test.client.flush)
    .then(() => runCLI('get-meta test/node dummy'))
    .then(data => {
      expect(JSON.parse(data)).to.deep.equal({'a': 1, 'b': 2})
    })
  })
})

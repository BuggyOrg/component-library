/* global describe, it, beforeEach, process */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import connect from '../src/api'
import {exec} from 'child_process'
import allWaiting from './allWaiting'
import config from './testCfg'

chai.use(chaiAsPromised)
var expect = chai.expect

process.env.BUGGY_COMPONENT_LIBRARY_HOST = 'http://localhost:9200'

describe('Component library CLI', () => {
  var test = {client: null}
  beforeEach(function () {
    test.prefix = 'cli' + Math.ceil(Math.random() * 999)
    test.client = connect('localhost:' + config.httpPort, test.prefix)
    return test.client.init().then(test.client.clear)
  })

  const runCLI = (args, data) => {
    return new Promise((resolve, reject) => {
      var cli = exec('node lib/cli -s -e localhost:' + config.httpPort + ' -p ' + test.prefix + ' ' + args,
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

  it('sets meta data with an array for a specific node', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => runCLI('set-meta test/node dummy', '{"a":[1,2],"b":["2"]}'))
    .then(test.client.flush)
    .then(() => test.client.getMeta('test/node', '0.0.1', 'dummy'))
    .then(data => {
      expect(data).to.deep.equal({"a":[1,2],"b":["2"]})
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

  it('`get-meta` gets a list of all meta data entries if no key is specified', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(test.client.flush)
    .then(() => test.client.setMeta('test/node', '0.0.1', 'code/golang', 'a <- b'))
    .then(() => test.client.setMeta('test/node', '0.0.1', 'nothing', ''))
    .then(test.client.flush)
    .then(() => runCLI('get-meta test/node'))
    .then(data => {
      expect(Object.keys(JSON.parse(data))).to.have.length(2)
    })
  })

  it('sets a global configuration', () => {
    runCLI('set-config test cfg value')
    .then(test.client.flush)
    .then(() => test.client.get('test', 'cfg'))
    .then(data => {
      expect(data).to.deep.equal('val')
    })
  })

  it('sets a global configuration', () => {
    test.client.setConfig('test', 'cfg', 'val')
    .then(test.client.flush)
    .then(() => runCLI('get-config test cfg'))
    .then(data => {
      expect(data).to.deep.equal('val')
    })
  })

  it('gets a list of all nodes, supporting limit and offset options', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(() => test.client.insert({
      id: 'test/node',
      version: '0.0.2'
    }))
    .then(test.client.flush)
    .then(() => runCLI('list --limit 2'))
    .then(stdout => {
      const nodes = JSON.parse(stdout)
      expect(nodes).to.have.lengthOf(2)

      const secondNode = nodes[1]

      return runCLI('list --limit 2 --offset 1')
      .then(stdout => {
        var nodes = JSON.parse(stdout)
        expect(nodes).to.have.lengthOf(1)
        expect(nodes[0]).to.deep.equal(secondNode)
      })
    })
  })
})

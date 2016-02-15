/* global describe, it, beforeEach */

var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var api = require('../src/api.js')

chai.use(chaiAsPromised)
var expect = chai.expect

describe('Elastic search meta information interface', () => {
  var test = {client: null}
  beforeEach(function () {
    this.timeout(10000)
    test.client = api.connect('localhost:9200', 'tests_')
    return test.client.init().then(test.client.clear)
  })

  it('should add meta information for a node', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      .then(() => test.client.setMeta('test/node', '0.0.1', 'code/golang', 'a <- b'))
      .then(() => test.client.getMeta('test/node', 'code/golang'))
      .then(meta => {
        expect(meta).to.have.length(1)
        expect(meta[0].meta).to.equal('a <- b')
      })
  })

  it('allows updates on existing meta information', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      .then(() => test.client.setMeta('test/node', '0.0.1', 'code/golang', 'a <- b'))
      .then(() => test.client.setMeta('test/node', '0.0.1', 'code/golang', 'c <- b'))
      .then(() => test.client.getMeta('test/node', 'code/golang'))
      .then(meta => {
        expect(meta).to.have.length(1)
        expect(meta[0].meta).to.equal('c <- b')
      })
  })

  it('can set the code for a specific node and version', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      .then(() => test.client.insert({
        id: 'test/node',
        version: '0.0.2'
      }))
      .then(() => test.client.setCode('test/node', '0.0.2', 'golang', 'a <- b'))
      .then(() => test.client.setCode('test/node', '0.0.1', 'golang', 'a <- c'))
      .then(() => test.client.getCode('test/node', '0.0.2', 'golang'))
      .then((code) => {
        expect(code).to.be.a('string')
        expect(code).to.equal('a <- b')
      })
  })
})

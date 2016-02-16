/* global describe, it, beforeEach */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import connect from '../src/api'
import allWaiting from './allWaiting'

chai.use(chaiAsPromised)
var expect = chai.expect

describe('Elastic search meta information interface', () => {
  var test = {client: null}
  beforeEach(function () {
    this.timeout(10000)
    test.client = connect('localhost:9200', 'tests')
    return test.client.init().then(test.client.clear)
  })

  it('should add meta information for a node', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      .then(() => test.client.setMeta('test/node', '0.0.1', 'code/golang', 'a <- b'))
      .then(() => test.client.getMeta('test/node', '0.0.1', 'code/golang'))
      .then(meta => {
        expect(meta.data).to.equal('a <- b')
      })
  })

  it('allows updates on existing meta information', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      .then(() => test.client.setMeta('test/node', '0.0.1', 'code/golang', 'a <- b'))
      .then(() => test.client.setMeta('test/node', '0.0.1', 'code/golang', 'c <- b'))
      .then(() => test.client.getMeta('test/node', '0.0.1', 'code/golang'))
      .then(meta => {
        expect(meta.data).to.equal('c <- b')
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
      .then(() => test.client.setCode('test/node', '0.0.2', 'nothing', ''))
      .then(() => test.client.setCode('test/node', '0.0.1', 'golang', 'a <- c'))
      .then(() => test.client.getCode('test/node', '0.0.2', 'golang'))
      .then((code) => {
        expect(code).to.be.a('string')
        expect(code).to.equal('a <- b')
      })
  })

  it('meta information is carried over from earlier versions', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      .then(() => test.client.setCode('test/node', '0.0.1', 'golang', 'a <- b'))
      .then(test.client.flush)
      .then(() => test.client.insert({
        id: 'test/node',
        version: '0.0.2'
      }))
      .then(() => test.client.getCode('test/node', '0.0.2', 'golang'))
      .then(code => {
        expect(code).to.be.a('string')
        expect(code).to.equal('a <- b')
      })
  })

  it('uses the predecessor for carrying metadata to newly created version', () => {
    return allWaiting([
      test.client.insert({
        id: 'test/node',
        version: '0.0.1'
      }),
      test.client.insert({
        id: 'test/node',
        version: '0.0.3'
      })]
    )
      .then(() => test.client.setCode('test/node', '0.0.1', 'golang', 'a <- b'))
      .then(() => test.client.setCode('test/node', '0.0.3', 'golang', 'c <- b'))
      .then(test.client.flush)
      .then(() => test.client.insert({
        id: 'test/node',
        version: '0.0.2'
      }))
      .then(() => test.client.getCode('test/node', '0.0.2', 'golang'))
      .then(code => {
        expect(code).to.be.a('string')
        expect(code).to.equal('a <- b')
      })
  })

  it('carrying metadata is controlled by a flag', () => {
    return expect(test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      .then(() => test.client.setCode('test/node', '0.0.1', 'golang', 'a <- b'))
      .then(test.client.flush)
      .then(() => test.client.insert({
        id: 'test/node',
        version: '0.0.2'
      }, false))
      .then(() => test.client.getCode('test/node', '0.0.2', 'golang')))
      .to.be.rejected
  })
})

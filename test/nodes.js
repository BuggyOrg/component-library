/* global describe, it, beforeEach */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import connect from '../src/api'
import allWaiting from './allWaiting'
import config from './testCfg'

chai.use(chaiAsPromised)
var expect = chai.expect

describe('Elastic search node interface', () => {
  var test = {client: null}
  beforeEach(function () {
    test.client = connect('localhost:' + config.httpPort, 'tests')
    return test.client.init().then(test.client.clear)
  })

  it('should be initialized with an empty database', function () {
    test.client.statistics().then((stats) => {
      expect(stats.nodeCount).to.equal(0)
    })
  })

  it('should insert a new object into the database', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
      // flush the database to ensure the newly inserted value is in the search index
      .then(test.client.flush)
      .then(() => { return test.client.query('test/node') })
      .then((items) => {
        expect(items).to.have.length(1)
      })
  })

  it('can retrieve a node', () => {
    return test.client.insert({
      id: 'test/node',
      version: '0.0.1'
    })
    .then(() => test.client.get('test/node', '0.0.1'))
    .then(node => {
      expect(node).to.be.an('object')
      expect(node.id).to.equal('test/node')
      expect(node.version).to.equal('0.0.1')
    })
  })

  it('normalizes version numbers', () => {
    return test.client.insert({
      id: 'test/node',
      version: 'v0.0.1'
    })
    .then(() => test.client.get('test/node', '0.0.1'))
    .then(node => {
      expect(node).to.be.an('object')
      expect(node.id).to.equal('test/node')
      expect(node.version).to.equal('0.0.1')
    })
  })

  it('errors if the node does not contain an id', () => {
    return expect(test.client.insert({
      version: '0.0.1'
    })).to.be.rejected
  })

  it('errors if the node does not contain a version', () => {
    return expect(test.client.insert({
      id: 'test/node'
    })).to.be.rejected
  })

  it('errors if the node id contains a @ character', () => {
    return expect(test.client.insert({
      id: 'test@node',
      version: '0.0.1'
    })).to.be.rejected
  })

  it('errors if the node does not contain an invalid version', () => {
    return expect(test.client.insert({
      id: 'test/node',
      version: '0.0.0.1'
    })).to.be.rejected
  })

  it('is not possible to store a node with the same version twice', () => {
    return expect(allWaiting([
      test.client.insert({id: 'test/node', version: '0.0.1'}),
      test.client.insert({id: 'test/node', version: '0.0.1'})
    ])).to.be.rejected
  })

  it('can list all versions of a node', () => {
    return allWaiting([
      test.client.insert({id: 'test/node', version: '0.0.1'}),
      test.client.insert({id: 'test/node', version: '0.0.2'}),
      test.client.insert({id: 'test2/node', version: '0.0.1'})
    ])
      // flush the database to ensure the newly inserted value is in the search index
      .then(test.client.flush)
      .then(() => { return test.client.versions('test/node') })
      .then((versions) => {
        expect(versions).to.have.length(2)
      })
  })

  it('can get the highest version of a node', () => {
    return allWaiting([
      test.client.insert({id: 'test/node', version: '0.0.1'}),
      test.client.insert({id: 'test/node', version: '0.0.2'}),
      test.client.insert({id: 'test2/node', version: '0.0.1'})
    ])
      // flush the database to ensure the newly inserted value is in the search index
      .then(test.client.flush)
      .then(() => { return test.client.getLatestVersion('test/node') })
      .then((version) => {
        expect(version).to.equal('0.0.2')
      })
  })

  it('finds the predecessor of a node', () => {
    return allWaiting([
      test.client.insert({id: 'test/node', version: '0.0.1'}),
      test.client.insert({id: 'test/node', version: '0.0.2'}),
      test.client.insert({id: 'test/node', version: '0.1.1'})
    ])
      .then(test.client.flush)
      .then(() => test.client.predecessor('test/node', '0.1.1'))
      .then((pred) => {
        expect(pred).to.be.an('object')
        expect(pred.version).to.equal('0.0.2')
      })
  })
})

/* global describe, it, beforeEach */

var chai = require('chai')
var chaiAsPromised = require('chai-as-promised')
var api = require('../src/api.js')

chai.use(chaiAsPromised)
var expect = chai.expect

describe('Component library elastic interface', () => {
  var test = {client: null}
  beforeEach(function () {
    this.timeout(10000)
    test.client = api.connect('localhost:9200', 'tests_')
    return test.client.init().then(() => { return test.client.clear() })
  })

  it('should be initialized with an empty database', function () {
    test.client.statistics().then((stats) => {
      expect(stats.nodeCount).to.equal(0)
    })
  })

  it('should put a new object into the database', () => {
    return test.client.put({
      id: 'test/node',
      version: '0.0.1'
    })
      // flush the database to ensure the newly put value is in the search index
      .then(() => { return test.client.flush() })
      .then(() => { return test.client.query('test/node') })
      .then((items) => {
        expect(items).to.have.length(1)
      })
  })

  it('errors if the node does not contain an id', () => {
    return expect(test.client.put({
      version: '0.0.1'
    })).to.be.rejected
  })

  it('errors if the node does not contain a version', () => {
    return expect(test.client.put({
      id: 'test/node'
    })).to.be.rejected
  })

  it('errors if the node does not contain an invalid version', () => {
    return expect(test.client.put({
      id: 'test/node',
      version: '0.0.0.1'
    })).to.be.rejected
  })

  it('is not possible to store a node with the same version twice', () => {
    return expect(Promise.all([
      test.client.put({id: 'test/node', version: '0.0.1'}),
      test.client.put({id: 'test/node', version: '0.0.1'})
    ])).to.be.rejected
  })

  it('can list all versions of a node', () => {
    return Promise.all([
      test.client.put({id: 'test/node', version: '0.0.1'}),
      test.client.put({id: 'test/node', version: '0.0.2'}),
      test.client.put({id: 'test2/node', version: '0.0.1'})
    ])
      // flush the database to ensure the newly put value is in the search index
      .then(() => { return test.client.flush() })
      .then(() => { return test.client.versions('test/node') })
      .then((versions) => {
        expect(versions).to.have.length(2)
      })
  })
})

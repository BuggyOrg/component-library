/* global describe, it, beforeEach */

var expect = require('chai').expect
var api = require('../src/api.js')

describe('Component library elastic interface', () => {
  var test = {client: null}
  beforeEach(() => {
    test.client = api.connect('localhost:9200', 'tests_')
    test.client.clear()
  })

  it('Tests an empty database', function () {
    test.client.statistics().then((stats) => {
      expect(stats.nodeCount).to.equal(0)
    })
  })
})

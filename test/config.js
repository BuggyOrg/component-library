/* global describe, it, beforeEach */

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import connect from '../src/api'

chai.use(chaiAsPromised)
var expect = chai.expect

describe('Elastic search configuration interface', () => {
  var test = {client: null}
  beforeEach(function () {
    this.timeout(10000)
    test.client = connect('localhost:9200', 'tests')
    return test.client.init().then(test.client.clear)
  })

  it('should add configuration options', () => {
    return test.client.setConfig('languages', 'golang', {ending: '.go'})
      .then(() => test.client.getConfig('languages', 'golang'))
      .then(config => {
        expect(config).to.be.ok
        expect(config.ending).to.equal('.go')
      })
  })
})

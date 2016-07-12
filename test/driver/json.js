/* global describe it */

import chai from 'chai'
import * as driver from '../../src/driver/json'

var expect = chai.expect

describe('Backend Driver', () => {
  describe.only('JSON Driver', () => {
    it('can query configuration data', () => {
      expect(driver.getConfig({config: {test: 1}}, 'test')).to.equal(1)
    })

    it('can query deep in the configuration', () => {
      expect(driver.getConfig({config: {a: {b: 2}}}, 'a/b')).to.equal(2)
    })

    it('throws an expection if the path is not defined', () => {
      expect(() => driver.getConfig({}, 'a.b')).to.throw(Error)
    })
  })
})

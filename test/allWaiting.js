var _ = require('lodash')
var Q = require('q')

module.exports = function (promiseArr) {
  return new Promise((resolve, reject) => {
    Q.allSettled(promiseArr)
    .then((results) => {
      var errors = _.reduce(results, (a, v) => {
        if (v.state !== 'fulfilled') {
          return a.concate([v.reason])
        } else {
          return a
        }
      }, [])
      if (errors.length === 0) {
        resolve(results)
      } else {
        reject(errors)
      }
    })
    .catch(reject)
  })
}

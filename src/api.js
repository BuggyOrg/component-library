/* global __dirname */

import * as elastic from 'elasticsearch'
import _ from 'lodash'
import semver from 'semver'

const extractHits = _.partial(_.get, _, 'hits.hits')
const mapHits = _.partial(_.map, _, _.partial(_.get, _, '_source'))
const valid = (obj) => {
  if (!obj.id) {
    return {error: 'Node must have a meta-id', valid: false}
  } else if (!obj.version) {
    return {error: 'Node must have an id', valid: false}
  } else if (!semver.valid(obj.version)) {
    return {error: 'Node must have a valid semver version', valid: false}
  } else {
    return {valid: true}
  }
}

const normalizeNode = function (node) {
  var normNode = _.clone(node)
  normNode.verion = semver.clean(node.version)
  return normNode
}

const clearIndex = function (api, client, index) {
  return api.flush()
    .then(() => client.search({index: index, q: '*'}))
    .then((v) => {
      v.hits.hits.forEach((v) => {
        client.delete({index: index, type: v._type, id: v._id})
      })
    })
    .then(() => api.flush())
}

export function connect (host, prefix = '') {
  var client = new elastic.Client({
    host: host
  })

  const nodesIndex = prefix + '_nodes'
  const metaIndex = prefix + '_meta'
  const indices = [nodesIndex, metaIndex]

  var api = {
    isConnected: () => {
      return client.ping()
    },

    query: id => {
      return client.search(
        {
          index: nodesIndex,
          body: {
            query: {
              match: {
                id: id
              }
            }
          }
        })
        .then(extractHits)
        .then(mapHits)
    },

    list: id => {
      return client.search(
        {
          index: nodesIndex,
          type: id
        })
        .then(extractHits)
        .then(mapHits)
    },

    get: (id, version) => {
      return client.get(
        {
          index: nodesIndex,
          id: id + '@' + semver.clean(version)
        }
      )
    },

    versions: id => {
      return api.list(id)
        .then(_.partial(_.map, _, (s) => s.version))
    },

    flush: () => {
      return Promise.all(_.map(indices, i => client.indices.refresh({index: i})))
    },

    statistics: () => {
      return Promise.all(
        [
          client.count({index: nodesIndex})
        ]).then((count) => {
          return {nodeCount: count}
        })
    },

    put: node => {
      var isValid = valid(node)
      if (isValid.valid === true) {
        var normNode = normalizeNode(node)
        return client.create({
          index: nodesIndex,
          type: normNode.id,
          id: normNode.id + '@' + normNode.version,
          body: normNode
        })
      } else {
        return Promise.reject(isValid.error)
      }
    },

    init: () => {
      return Promise.all(
        _.map(indices, i => client.indices.exists({index: i}))
      ).then((ex) => {
        var createIndices = _(ex).chain()
          .zip(indices)
          .reject(zipped => zipped[0])
          .map(zipped => client.indices.create({index: zipped[1]}))
          .value()
        return Promise.all(createIndices)
      })
    },

    clear: () => {
      if (prefix === '') {
        throw new Error('Will not clear unprefixed Database')
      } else {
        return Promise.all(_.map(indices, i => clearIndex(api, client, i)))
      }
    }
  }

  return api
}

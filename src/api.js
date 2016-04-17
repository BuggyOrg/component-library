/* global __dirname */

import * as elastic from 'elasticsearch'
import _ from 'lodash'
import semver from 'semver'

const extractHits = _.partial(_.get, _, 'hits.hits')
const getSource = _.partial(_.get, _, '_source')
const mapHits = _.partial(_.map, _, getSource)
const valid = (obj) => {
  if (!obj.id) {
    return {error: 'Node must have a meta-id', valid: false}
  } else if (obj.id.indexOf('@') !== -1) {
    return {error: 'Node id (' + obj.id + ') cannot have the special character @', valid: false}
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
  normNode.version = semver.clean(node.version)
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

export default function connect (host, prefix = '') {
  var client = new elastic.Client({
    host: host
  })

  if (prefix.length !== 0) {
    prefix += '_'
  }
  const nodesIndex = prefix + 'nodes'
  const metaIndex = prefix + 'meta'
  const configIndex = prefix + 'configuration'
  const indices = [nodesIndex, metaIndex, configIndex]

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
      var versionProm = Promise.resolve(version)
      if (!version) {
        versionProm = api.getLatestVersion(id)
      }
      return versionProm
        .then((v) => client.get(
          {
            index: nodesIndex,
            type: id,
            id: id + '@' + semver.clean(v)
          }
        ))
        .then(getSource)
    },

    versions: id => {
      return api.list(id)
        .then(_.partial(_.map, _, (s) => s.version))
    },

    setMeta: (node, version, key, meta) => {
      return client.update({
        index: metaIndex,
        type: node,
        id: node + '@' + semver.clean(version),
        body: {
          script: 'ctx._source.elements += element',
          params: {
            element: {
              version: semver.clean(version),
              key: key,
              data: JSON.stringify(meta)
            }
          }
        }
      })
    },

    getMeta: (node, version, key) => {
      return client.get(
        {
          index: metaIndex,
          type: node,
          id: node + '@' + semver.clean(version)
        }
      )
        .then(getSource)
        .then((meta) => {
          var elem = _(meta.elements).chain()
            .filter(m => m.key === key)
            .findLast(m => semver.satisfies(m.version, version))
            .value()
          return (elem) ? JSON.parse(elem.data) : undefined
        })
    },

    getLatestMeta: (node, key) => {
      return api.getLatestVersion(node)
      .then((version) => api.getMeta(node, version, key))
    },

    getAllMeta: (node, version) => {
      return client.get(
        {
          index: metaIndex,
          type: node,
          id: node + '@' + semver.clean(version)
        }
      )
        .then(getSource)
        .then((meta) => {
          var elem = _(meta.elements).chain()
            .filter(m => semver.satisfies(m.version, version))
            .map(m => ({key: m.key, data: m.data}))
            .keyBy('key')
            .value()
          return elem
        })
    },

    setCode: (node, validity, language, meta) => {
      return api.setMeta(node, validity, 'code/' + language, meta)
    },

    getCode: (node, version, language) => {
      return api.getMeta(node, version, 'code/' + language)
    },

    getLatestCode: (node, language) => {
      return api.getLatestMeta(node, 'code/' + language)
    },

    setConfig: (type, config, value) => {
      return new Promise(resolve => {
        return client.index({
          index: configIndex,
          type: type,
          id: config,
          body: {
            value: value
          }
        })
        .then(config => resolve(config))
        .catch(() => resolve())
      })
    },

    getConfig: (type, config) => {
      return client.get(
        {
          index: configIndex,
          type: type,
          id: config
        }
      )
        .then(getSource)
        .then(v => v.value)
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

    getLatestVersion: node => {
      return api.list(node)
      .then(list => {
        return _.last(list.sort((a, b) => { return semver.compare(a.version, b.version) })).version
      })
    },

    insert: (node, copyMetadata = true) => {
      var isValid = valid(node)
      if (isValid.valid === true) {
        var normNode = normalizeNode(node)
        return client.create({
          index: nodesIndex,
          type: normNode.id,
          id: normNode.id + '@' + normNode.version,
          body: normNode
        })
        .then(() => {
          return api.predecessorMeta(normNode.id, normNode.version)
        })
        .then(predMeta => {
          let elements = (typeof predMeta === 'object' && Array.isArray(predMeta._source.elements))
            ? predMeta._source.elements
            : []
          elements = _.map(elements, e => {
            return _.merge({}, e, {version: normNode.version})
          })
          if (!copyMetadata) {
            elements = []
          }
          return client.create({
            index: metaIndex,
            type: normNode.id,
            id: normNode.id + '@' + normNode.version,
            body: {
              elements: elements
            }
          })
        })
      } else {
        return Promise.reject(isValid.error)
      }
    },

    // returns the node that precedes
    predecessor: (nodeId, version) => {
      return api.list(nodeId)
        .then((list) => {
          let older = _.filter(list, i => semver.lt(i.version, version))
          return _.last(older.sort((a, b) => { return semver.compare(a.version, b.version) }))
        })
    },

    predecessorMeta: (nodeId, version) => {
      return new Promise((resolve, reject) => {
        api.predecessor(nodeId, version)
          .then(pred => {
            return client.get({
              index: metaIndex,
              type: pred.id,
              id: pred.id + '@' + pred.version
            })
          })
          .then((predMeta) => {
            resolve(predMeta)
          })
          .catch(() => {
            // if there is no predecessor resolve with nothing
            resolve()
          })
      })
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

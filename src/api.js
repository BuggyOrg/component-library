/* global __dirname */

import {readFileSync} from 'fs'
import glob from 'glob'
import {join} from 'path'
import * as elastic from 'elasticsearch'
import _ from 'lodash'
import semver from 'semver'

export function getAllMetaPaths (path) {
  path = path || join(__dirname, '/../meta')
  return glob.sync(join(path, '/**/*.json'))
}

export function getMetaFromPath (path) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

export function getComponentLibrary () {
  var paths = getAllMetaPaths()
  var lib = {}

  for (var i = 0; i < paths.length; i++) {
    var path = paths[i]
    var meta = getMetaFromPath(path)
    lib[meta.id] = meta
  }

  return lib
}

export function getCode (id, language, componentLibrary) {
  var codePath = '/../' + componentLibrary[id]['implementation'][language]
  var path = join(__dirname, codePath)
  return readFileSync(path, 'utf8')
}

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

var normalizeNode = function (node) {
  var normNode = _.clone(node)
  normNode.verion = semver.clean(node.version)
  return normNode
}

export function connect (host, prefix = '') {
  var client = new elastic.Client({
    host: host
  })

  var api = {
    isConnected: () => {
      return client.ping()
    },

    query: id => {
      return client.search(
        {
          index: prefix + 'meta',
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
          index: prefix + 'meta',
          type: id
        })
        .then(extractHits)
        .then(mapHits)
    },

    get: (id, version) => {
      return client.get(
        {
          index: prefix + 'meta',
          id: id + '@' + semver.clean(version)
        }
      )
    },

    versions: id => {
      return api.list(id)
        .then(_.partial(_.map, _, (s) => s.version))
    },

    flush: () => {
      return client.indices.refresh({index: prefix + 'meta'})
    },

    statistics: () => {
      return Promise.all(
        [
          client.count({index: prefix + 'meta'})
        ]).then((count) => {
          return {nodeCount: count}
        })
    },

    put: node => {
      var isValid = valid(node)
      if (isValid.valid === true) {
        var normNode = normalizeNode(node)
        return client.create({
          index: prefix + 'meta',
          type: normNode.id,
          id: normNode.id + '@' + normNode.version,
          body: normNode
        })
      } else {
        return Promise.reject(isValid.error)
      }
    },

    init: () => {
      var indices = ['meta']
      return Promise.all(
        _.map(indices, i => client.indices.exists({index: prefix + i}))
      ).then((ex) => {
        var createIndices = _(ex).chain()
          .zip(indices)
          .reject(zipped => zipped[0])
          .map(zipped => client.indices.create({index: prefix + zipped[1]}))
          .value()
        return Promise.all(createIndices)
      })
    },

    clear: () => {
      if (prefix === '') {
        throw new Error('Will not clear unprefixed Database')
      } else {
        return api.flush()
          .then(() => client.search({index: prefix + 'meta', q: '*'}))
          .then((v) => {
            v.hits.hits.forEach((v) => {
              client.delete({index: prefix + 'meta', type: v._type, id: v._id})
            })
          })
          .then(() => api.flush())
      }
    }
  }

  return api
}

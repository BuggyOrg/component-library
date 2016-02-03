/* global __dirname */

import {readFileSync} from 'fs'
import glob from 'glob'
import {join} from 'path'
import * as elastic from 'elasticsearch'
import _ from 'lodash'

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
  if (obj.id) {
    return true
  } else {
    return 'Every node must have an meta-id'
  }
}

export function connect (host, prefix = '') {
  var client = new elastic.Client({
    host: host
  })

  return {
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

    put: node => {
      var isValid = valid(node)
      if (isValid === true) {
        return client.index({
          index: prefix + 'meta',
          type: node.id,
          body: node
        })
      } else {
        throw new Error(isValid)
      }
    },

    clear: () => {
      if (prefix === '') {
        throw new Error('Will not clear unprefixed Database')
      } else {
        return client
          .search({index: prefix + 'meta', q: '*'})
          .then((v) => {
            v.hits.hits.forEach((v) => { 
              client.delete({index: prefix + 'meta', type: v._type, id: v._id})
            })
          })
      }
    },

    esSearch: () => { return client.search }
  }
}

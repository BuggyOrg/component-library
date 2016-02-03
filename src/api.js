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

var extractHits = _.partial(_.get, _, 'hits.hits')
var mapHits = _.partial(_.map, _, _.partial(_.get, _, '_source'))

export function connect (host) {
  const client = new elastic.Client({
    host: host
  })

  return {
    isConnected: () => {
      return client.ping()
    },

    query: id => {
      return client.search(
        {
          index: 'meta',
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
    }
  }
}

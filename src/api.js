/* global __dirname */

import {readFileSync} from 'fs'
import glob from 'glob'
import {join} from 'path'

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

import {readFileSync} from 'fs'
import glob from 'glob'

var api = {
  getAllMetaPaths: function () {
    return glob.sync(__dirname + '/../meta/**/*.json')
  },

  getMetaFromPath: function (path) {
    return JSON.parse(readFileSync(path, 'utf8'))
  },

  getComponentLibrary: function () {
    var paths = api.getAllMetaPaths()
    var lib = {}

    for (var i = 0; i < paths.length; i++) {
      var path = paths[i]
      var meta = api.getMetaFromPath(path)
      lib[meta.id] = meta
    }

    return lib
  },

  getCode: function (id, language, componentLibrary) {
    var codePath = componentLibrary[id]['implementation'][language]
    return readFileSync(codePath, 'utf8')
  }
}

module.exports = api

import {readFileSync} from 'fs'
import glob from 'glob'
import {join} from path

var api = {
  getAllMetaPaths: function (path) {
    path = path || join(__dirname, '/../meta')
    return glob.sync(join(path, "/**/*.json"))
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

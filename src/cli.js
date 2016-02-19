#!/usr/bin/env node
/* global __dirname, process */

import program from 'commander'
import fs from 'fs'
import connect from './api'
import getStdin from 'get-stdin'
import chalk from 'chalk'
import tempfile from 'tempfile'
import {spawn} from 'child_process'
import semver from 'semver'
import path from 'path'
import {elasticdump} from 'elasticdump'
import _ from 'lodash'

var server = ''
var defaultElastic = ' Defaults to BUGGY_COMPONENT_LIBRARY_HOST'

const log = function (...args) {
  if (!program.silent) {
    console.log.call(console.log, ...args)
  }
}

const edit = (file) => {
  return new Promise((resolve, reject) => {
    var editor = spawn('vim', [file], {stdio: 'inherit'})
    editor.on('exit', () => {
      fs.readFile(file, 'utf8', (err, contents) => {
        if (err) {
          reject(err)
        } else {
          resolve(contents)
        }
      })
    })
  })
}

const stdinOrEdit = (getFiletype, promiseAfter) => {
  if (process.stdin.isTTY) {
    log('no stdin input starting editor')
    return new Promise((resolve) => {
      if (typeof getFiletype !== 'function') {
        resolve(tempfile(getFiletype))
      } else {
        getFiletype().then((filetype) => { resolve(tempfile(filetype)) })
          .catch(() => resolve(tempfile('')))
      }
    })
    .then((tmpFile) => {
      return edit(tmpFile).then((content) => {
        fs.unlinkSync(tmpFile)
        return content
      })
    })
    .then((content) => {
      return promiseAfter(content)
    })
  } else {
    return getStdin().then((content) => {
      // we got something on stdin, don't open the editor
      return promiseAfter(content)
    })
  }
}

const versionOrLatest = (node, version, client) => {
  if (version) {
    if (semver.valid(version)) {
      return Promise.resolve(semver.clean(version))
    } else {
      return Promise.reject('Invalid version given for ' + node + '@' + version)
    }
  } else if (node.indexOf('@') !== -1) {
    var nodeVersion = node.split('@')[1]
    if (node.split('@').length !== 2) {
      return Promise.reject('Invalid node name. Can only contain one version seperator (@) in: ' + node)
    } else if (!semver.valid(nodeVersion)) {
      return Promise.reject('Invalid version for node ' + node)
    } else {
      return Promise.resolve(semver.clean(nodeVersion))
    }
  } else {
    return client.getLatestVersion(node)
      .then(version => {
        log('No valid version given using latest ' + node + '@' + version)
        return version
      })
  }
}

if (process.env.BUGGY_COMPONENT_LIBRARY_HOST) {
  server = process.env.BUGGY_COMPONENT_LIBRARY_HOST
  defaultElastic += '=' + server
} else {
  server = 'http://localhost:9200'
  defaultElastic += ' or if not set to http://localhost:9200'
}

program
  .version(JSON.parse(fs.readFileSync(__dirname + '/../package.json'))['version'])
  .option('-e, --elastic <host>', 'The elastic server to connect to.' + defaultElastic, String, server)
  .option('-p, --prefix <prefix>', 'Prefixes the database indices.', String, '')
  .option('-s, --silent', 'Only print data no further information.')
  .parse(process.argv)

program
  .command('query <name>')
  .description('Query detailed information for a specific component. This command can be used to search nodes.')
  .action((name) => {
    var client = connect(program.elastic, program.prefix)
    client.query(name).then((node) => {
      log(JSON.stringify(node, null, 2))
    })
    .catch(err => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

program
  .command('get <node-id> [version]')
  .description('Get a node document by the id of the node. If the version is not specified it prints automatically the latest version')
  .action((nodeID, version) => {
    var client = connect(program.elastic, program.prefix)
    versionOrLatest(nodeID, version, client)
    .then(version => {
      return client.get(nodeID, version)
    })
    .then(node => {
      console.log(JSON.stringify(node, null, 2))
    })
    .catch(err => {
      console.err(chalk.red(err))
      process.exit(-1)
    })
  })

program
  .command('insert')
  .description('Add a node to the component library. It opens an editor (env EDITOR) window or you can pipe the node into it.')
  .action(() => {
    var client = connect(program.elastic, program.prefix)
    stdinOrEdit('.json', (content) => {
      var node = JSON.parse(content)
      return client.insert(node).then(() => node)
    })
    .then((node) => {
      log(chalk.bgGreen('Successfully stored node with id: ' + node.id + '@' + node.version))
    })
    .catch((err) => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

program
  .command('set-code <node-id> <language> [version]')
  .description('Add set code for a node in a specific programming language. It opens an editor (env EDITOR) window or you can pipe the code into it.')
  .action((node, language, version) => {
    var client = connect(program.elastic, program.prefix)
    stdinOrEdit(() => client.getConfig('language', language),
      (content) =>
        versionOrLatest(node, version, client)
        .then(nodeVersion => client.setCode(node, nodeVersion, language, content)))
    .then(() => {
      log(chalk.bgGreen('Successfully stored code for node: ' + node))
    })
    .catch((err) => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

program
  .command('get-code <node-id> <language> [version]')
  .description('Get the implementation of a node in the specified language')
  .action((node, language, version) => {
    var client = connect(program.elastic, program.prefix)
    versionOrLatest(node, version, client)
    .then((nodeVersion) => client.getCode(node, nodeVersion, language))
    .then((code) => {
      log('Implementation of "' + node + '" in "' + language + '"')
      console.log(code)
    })
    .catch(err => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

program
  .command('set-meta <node-id> <key> [version]')
  .description('Set the meta information (as json) for a node for a specific key. It opens an editor (env EDITOR) window or you can pipe the json document into it. If the version is not specified it sets the meta information on the latest version.')
  .action((node, key, version) => {
    var client = connect(program.elastic, program.prefix)
    stdinOrEdit('.json',
      (content) => {
        var data
        try {
          data = JSON.parse(content)
        } catch (err) {
          throw new Error('Unable parse JSON data. Please provide a JSON document.')
        }
        return versionOrLatest(node, version, client)
        .then(nodeVersion => client.setMeta(node, nodeVersion, key, data))
      })
    .then(() => console.log('Successfully change meta key "' + key + '" of "' + node + '"'))
    .catch(err => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

program
  .command('get-meta <node-id> [key] [version]')
  .option('-k, --key <key>', 'The meta key to query. If you don\'t provide a key it will print all meta information for the node')
  .option('-v, --version <nodeVersion>', 'The version of the node. If the version is not specified it sets the meta information on the latest version.')
  .description('Get the meta information for a node by id.')
  .action((node, key, version, options) => {
    var client = connect(program.elastic, program.prefix)
    key = key || options.key
    version = version || options.nodeVersion
    versionOrLatest(node, version, client)
    .then(nodeVersion => {
      if (key) {
        return client.getMeta(node, nodeVersion, key)
      } else {
        return client.getAllMeta(node, nodeVersion)
      }
    })
    .then(data => console.log(JSON.stringify(data)))
    .catch(err => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

var dumpOptions = {
  all: false, limit: 100, offset: 0, debug: false, type: 'data', delete: false, bulk: false, maxSockets: null,
  'input-index': null, 'output-index': null, inputTransport: null, outputTransport: null, searchBody: null,
  sourceOnly: false, jsonLines: false, format: '', 'ignore-errors': false, scrollTime: '10m',
  'bulk-use-output-index-name': false, 'bulk-mode': 'index', timeout: null, skip: null, toLog: null
}

program
  .command('export <outfile>')
  .description('Export the whole component library into one file. You can either specify a plain .json document or a .gz archive.')
  .action((outfile, options) => {
    var exportOptions = _.merge({}, dumpOptions, {
      all: true,
      input: program.elastic,
      output: outfile
    })
    if (path.extname(outfile) === '.json') {
      // create json export
      var dumper = new elasticdump(options.input, options.output, exportOptions)
      dumper.on('log', message => { console.log('log', message) })
      dumper.on('debug', message => { console.log('debug', message) })
      dumper.on('error', error => { console.error('log', 'Error Emitted => ' + (error.message || JSON.stringify(error))) })

      dumper.dump((error, total_writes) => {
        console.log('done dumpnig', error)
        if (error) {
          process.exit(1)
        } else {
          process.exit(0)
        }
      })
    } else if (path.extname(outfile) === '.gz') {
      // TODO: pipe through zlib
    }
  })

program
  .command('import <infile>')
  .description('Import a backup into the elasticsearch database')
  .action((infile, options) => {
    var exportOptions = _.merge({}, dumpOptions, {
      bulk: true,
      input: infile,
      output: program.elastic
    })
    if (path.extname(infile) === '.json') {
      // create json export
      var dumper = new elasticdump(options.input, options.output, exportOptions)
      dumper.on('log', message => { console.log('log', message) })
      dumper.on('debug', message => { console.log('debug', message) })
      dumper.on('error', error => { console.error('log', 'Error Emitted => ' + (error.message || JSON.stringify(error))) })

      dumper.dump((error, total_writes) => {
        console.log('done dumpnig', error)
        if (error) {
          process.exit(1)
        } else {
          process.exit(0)
        }
      })
    } else if (path.extname(infile) === '.gz') {
      // TODO: pipe through zlib
    }
  })

program.parse(process.argv)

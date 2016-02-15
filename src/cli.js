#!/usr/bin/env node
/* global __dirname, process */

import program from 'commander'
import fs from 'fs'
import {connect} from './api'
import getStdin from 'get-stdin'
import chalk from 'chalk'
import tempfile from 'tempfile'
import {spawn} from 'child_process'

var server = ''
var defaultElastic = ' Defaults to BUGGY_COMPONENT_LIBRARY_HOST'

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
    console.log('no stdin input starting editor')
    return new Promise((resolve) => {
      if (typeof getFiletype !== 'function') {
        return tempfile(getFiletype)
      } else {
        return getFiletype().then((filetype) => tempfile(filetype))
      }
    })
    .then((tmpFile) => {
      return edit(tmpFile).then(() => fs.unlinkSync(tmpFile))
    })
    .then((content) => {
      return promiseAfter(content)
    })
  } else {
    getStdin().then((content) => {
      // we got something on stdin, don't open the editor
      return promiseAfter(content)
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
  .option('-p, --prefix <index_prefix>', 'Prefixes the database indices.', String, '')

program
  .command('query <name>')
  .option('-e, --elastic <host>', 'The elastic server to connect to.' + defaultElastic, String, server)
  .option('-p, --prefix <index_prefix>', 'Prefixes the database indices.', String, '')
  .description('query detailed information for a specific component')
  .action((name, options) => {
    console.log('connecting to ' + options.elastic)
    var client = connect(options.elastic, options.prefix)
    client.query(name).then((node) => {
      console.log(JSON.stringify(node, null, 2))
    })
  })

program
  .command('insert')
  .option('-e, --elastic <host>', 'The elastic server to connect to.' + defaultElastic, String, server)
  .option('-p, --prefix <index_prefix>', 'Prefixes the database indices.', String, '')
  .description('Add a node to the component library. It opens an editor (env EDITOR) window or you can pipe the node into it.')
  .action((options) => {
    var client = connect(options.elastic, options.prefix)
    stdinOrEdit('.json', (content) => {
      var node = JSON.parse(content)
      return client.insert(node).then(() => node)
    })
    .then((node) => {
      console.log(chalk.bgGreen('Successfully stored node with id: ' + node.id))
    })
    .catch((err) => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

program
  .command('set-code <node> <language> [validity]')
  .description('Add set code for a node in a specific programming language')
  .action((node, language, validity, options) => {
    var client = connect(options.elastic, options.prefix)
    stdinOrEdit(() => client.getConfig('language', language),
      (content) => client.setCode(node, validity, language, content))
    .then(() => {
      console.log(chalk.bgGreen('Successfully stored code for node: ' + node))
    }).catch((err) => {
      console.error(chalk.red(err.message))
      process.exit(-1)
    })
  })

program
  .command('get-code <node> <language> [version]')
  .description('Get the implementation of a node in the specified language')
  .action((node, language, version, options) => {
    var client = connect(options.elastic, options.prefix)
    client.getCode(node, version, language)
    .then((code) => {
      console.log('Implementation of "' + node + '" in "' + language + '"')
      console.log(code)
    })
  })

program
  .parse(process.argv)

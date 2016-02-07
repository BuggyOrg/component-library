#!/usr/bin/env node
/* global __dirname, process */

import program from 'commander'
import fs from 'fs'
import {connect} from './api'

var server = ''
var defaultElastic = ' Defaults to BUGGY_COMPONENT_LIBRARY_HOST'

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
  .parse(process.argv)

#!/usr/bin/env node
/* global __dirname, process */

import program from 'commander'
import fs from 'fs'
import _ from 'lodash'
import {getComponentLibrary} from './api'

const compLib = getComponentLibrary()

program
  .version(JSON.parse(fs.readFileSync(__dirname + '/../package.json'))['version'])

program
  .command('query <name>')
  .description('query detailed information for a specific component')
  .action(name => {
    console.log(JSON.stringify(compLib[name], null, 2))
  })

program
  .command('list')
  .alias('ls')
  .description('list all available components')
  .action(() => {
    console.log(_.map(_.values(compLib), 'id').join('\n'))
  })

program
  .parse(process.argv)

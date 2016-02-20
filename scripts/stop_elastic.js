/* global __dirname */

import chalk from 'chalk'
import processExists from 'process-exists'
import rimraf from 'rimraf'
import kill from './kill'
import fs from 'fs'
import isCi from 'is-ci'

export function killElastic (callback) {
  var contents = fs.readFileSync(__dirname + '/.download/running.pid', 'utf8')
  processExists(Number(contents)).then(exists => {
    if (exists) {
      console.log('elastic search already running with PID, ' + chalk.red('killing it: '), contents)
      kill(Number(contents), 'SIGTERM').then(() => {
        console.log(chalk.yellow('removing old data at ' + __dirname + '/.download/elastic/data/elasticsearch'))
        fs.unlinkSync(__dirname + '/.download/running.pid')
        rimraf(__dirname + '/.download/elastic/data/elasticsearch', () => {
          callback()
        })
      })
    } else {
      console.log('elastic search not running [old PID: ', contents, ']')
      callback()
    }
  })
}

if (!isCi && require.main === module) {
  killElastic(() => {
    console.log('stopped elastic instance successfully')
  })
}

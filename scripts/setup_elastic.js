/* global process, __dirname */
import * as elastic from 'elasticsearch'
import fs from 'fs'
import Download from 'download'
import zlib from 'zlib'
import tar from 'tar'
import child_process from 'child_process'
import processExists from 'process-exists'
import rimraf from 'rimraf'
import kill from './kill'
import chalk from 'chalk'
import * as yaml from 'yamljs'
import _ from 'lodash'
import config from '../test/testCfg'
import {killElastic} from './stop_elastic'

var isCi = false
var httpPort = config.httpPort
var transportPort = config.transportPort

var establishConnection = function () {
  return new Promise((resolve, reject) => {
    // Case 1: we are on a CI server. The CI server should have a service defined
    // Case 2: an elastic search server is set as an environment variable
    // Case 3: no running elastic server defined
    if (isCi) {
      console.log('running on a CI server')
      resolve({client: new elastic.Client({host: 'localhost:' + httpPort})})
    } else if (process.env.BUGGY_COMPONENT_LIBRARY_HOST) {
      console.log('using locally registered component library server', process.ENV.BUGGY_COMPONENT_LIBRARY_HOST)
      resolve({client: new elastic.Client({host: process.ENV.BUGGY_COMPONENT_LIBRARY_HOST})})
    } else {
      const runServer = () => {
        const startServer = () => {
          var conf = yaml.parse(fs.readFileSync(__dirname + '/.download/elastic/config/elasticsearch.yml', 'utf8')) || {}
          _.set(conf, 'script.groovy.sandbox.enabled', true)
          _.set(conf, 'script.inline', 'sandbox')
          _.set(conf, 'script.engine.groovy.inline.update', 'on')
          _.set(conf, 'transport.tcp.port', transportPort)
          _.set(conf, 'http.port', httpPort)
          fs.writeFileSync(__dirname + '/.download/elastic/config/elasticsearch.yml', yaml.stringify(conf, 2))
          var elasticInstance = child_process.spawn(__dirname + '/.download/elastic/bin/elasticsearch', {detached: true})
          fs.writeFileSync(__dirname + '/.download/running.pid', elasticInstance.pid)
          elasticInstance.stdout.on('data', (data) => {
            if (data.indexOf('started') !== -1) {
              resolve({client: new elastic.Client({host: 'localhost:' + httpPort}), instance: elasticInstance})
            }
          })
        }
        if (fs.existsSync(__dirname + '/.download/running.pid')) {
          killElastic(() => {
            console.log('starting new server')
            startServer()
          })
        } else {
          startServer()
        }
      }
      if (fs.existsSync(__dirname + '/.download/elastic') && fs.existsSync(__dirname + '/.download/elastic/bin/elasticsearch')) {
        console.log('elastic server instance found locally')
        runServer()
      } else {
        const downloaded = (err, files) => {
          if (err) {
            console.error('Error while downloading elasticsearch', err)
          } else {
            console.log('Downloaded ', files[0].path)
            fs.createReadStream(files[0].path)
              .pipe(zlib.createGunzip())
              .pipe(tar.Extract({path: __dirname + '/.download/elastic', strip: 1}).on('close', runServer))
          }
        }
        new Download({mode: 777})
          .get('https://download.elasticsearch.org/elasticsearch/release/org/elasticsearch/distribution/tar/elasticsearch/2.2.0/elasticsearch-2.2.0.tar.gz')
          .dest(__dirname + '/.download')
          .run(downloaded)
      }
    }
  })
}


establishConnection().then(({client, instance}) => {
  client.ping()
    .then(function () {
      return client.indices.refresh()
    })
    .then(function () {
      return client.cluster.health()
    })
    .then(function (health) {
      if (health.status === 'green') {
        console.log(chalk.bold(chalk.green('Elastic server is running and healthy')))
      } else {
        console.log(chalk.bold(chalk.green('Elastic server is running but has some issues')))
        console.log(chalk.bgYellow('Elastic Cluster Health:'))
        console.log(health)
      }
      if (instance) {
        instance.unref()
        process.exit(0)
      }
    })
    .catch(function () {
      console.error(chalk.red('Could not verify elastic server instance'))
      if (instance) {
        instance.kill()
      }
      process.exit(-1)
    })
})

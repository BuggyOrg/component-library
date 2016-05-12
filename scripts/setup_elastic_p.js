/* global process, __dirname */
import * as elastic from 'elasticsearch'
import fs from 'fs'
import Download from 'download'
import zlib from 'zlib'
import tar from 'tar'
import child_process from 'child_process'
import chalk from 'chalk'
import * as yaml from 'yamljs'
import _ from 'lodash'
import {killElastic} from './stop_elastic'

var httpPort = 9200
var transportPort = 9300

var establishConnection = function () {
  return new Promise((resolve, reject) => {
    const runServer = () => {
      const startServer = () => {
        var conf = yaml.parse(fs.readFileSync(__dirname + '/.download_p/elastic/config/elasticsearch.yml', 'utf8')) || {}
        _.set(conf, 'script.groovy.sandbox.enabled', true)
        _.set(conf, 'script.inline', 'sandbox')
        _.set(conf, 'script.engine.groovy.inline.update', 'on')
        _.set(conf, 'transport.tcp.port', transportPort)
        _.set(conf, 'http.port', httpPort)
        fs.writeFileSync(__dirname + '/.download_p/elastic/config/elasticsearch.yml', yaml.stringify(conf, 2))
        var elasticInstance = child_process.spawn(__dirname + '/.download_p/elastic/bin/elasticsearch', {detached: true})
        fs.writeFileSync(__dirname + '/.download_p/running.pid', elasticInstance.pid)
        elasticInstance.stdout.on('data', (data) => {
          if (data.indexOf('started') !== -1) {
            resolve({client: new elastic.Client({host: 'localhost:' + httpPort}), instance: elasticInstance})
          }
        })
        elasticInstance.stderr.on('data', data => {
          console.error(data.toString())
          process.exit(1)
        })
      }
      if (fs.existsSync(__dirname + '/.download_p/running.pid')) {
        killElastic(() => {
          console.log('starting new server')
          startServer()
        })
      } else {
        startServer()
      }
    }
    if (fs.existsSync(__dirname + '/.download_p/elastic') && fs.existsSync(__dirname + '/.download_p/elastic/bin/elasticsearch')) {
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
            .pipe(tar.Extract({path: __dirname + '/.download_p/elastic', strip: 1}).on('close', runServer))
        }
      }
      new Download({mode: 777})
        .get('https://download.elasticsearch.org/elasticsearch/release/org/elasticsearch/distribution/tar/elasticsearch/2.2.0/elasticsearch-2.2.0.tar.gz')
        .dest(__dirname + '/.download_p')
        .run(downloaded)
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

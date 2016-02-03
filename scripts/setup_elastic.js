/* global process, __dirname */
import isCi from 'is-ci'
import * as elastic from 'elasticsearch'
import fs from 'fs'
import Download from 'download'
import zlib from 'zlib'
import tar from 'tar'
import child_process from 'child_process'
import processExists from 'process-exists'

var establishConnection = function () {
  return new Promise((resolve, reject) => {
    // Case 1: we are on a CI server. The CI server should have a service defined
    // Case 2: an elastic search server is set as an environment variable
    // Case 3: no running elastic server defined
    if (isCi) {
      console.log('running on a CI server')
      resolve({client: new elastic.Client({host: 'localhost:9200'})})
    } else if (process.env.BUGGY_COMPONENT_LIBRARY_HOST) {
      console.log('using locally registered component library server', process.ENV.BUGGY_COMPONENT_LIBRARY_HOST)
      resolve({client: new elastic.Client({host: process.ENV.BUGGY_COMPONENT_LIBRARY_HOST})})
    } else {
      const runServer = () => {
        const startServer = () => {
          var elasticInstance = child_process.spawn(__dirname + '/.download/elastic/bin/elasticsearch', {detached: true})
          fs.writeFileSync(__dirname + '/.download/running.pid', elasticInstance.pid)
          elasticInstance.stdout.on('data', (data) => {
            if (data.indexOf('started') !== -1) {
              resolve({client: new elastic.Client({host: 'localhost:9200'}), instance: elasticInstance})
            }
          })
        }
        if (fs.existsSync(__dirname + '/.download/running.pid')) {
          var contents = fs.readFileSync(__dirname + '/.download/running.pid', 'utf8')
          processExists(Number(contents)).then(exists => {
            if (exists) {
              console.log('elastic search already running with PID: ', contents)
              resolve({client: new elastic.Client({host: 'localhost:9200'})})
            } else {
              console.log('elastic search not yet running [old PID: ', contents, ']')
              startServer()
            }
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
      console.log('successful pinged')
      if (instance) {
        instance.unref()
        process.exit(0)
      }
    })
    .catch(function () {
      console.log('could not ping elastic server')
      if (instance) {
        instance.kill()
      }
    })
})

/* global process, __dirname */
import isCi from 'is-ci'
import * as elastic from 'elasticsearch'
import fs from 'fs'
import Download from 'download'
import zlib from 'zlib'
import tar from 'tar'

var client

var establishConnection = function () {
  return new Promise((resolve, reject) => {
    // Case 1: we are on a CI server. The CI server should have a service defined
    // Case 2: an elastic search server is set as an environment variable
    // Case 3: no running elastic server defined
    if (isCi) {
      console.log('running on a CI server')
      resolve(new elastic.Client({host: 'localhost:9200'}))
    } else if (process.env.BUGGY_COMPONENT_LIBRARY_HOST) {
      console.log('using locally registered component library server', process.ENV.BUGGY_COMPONENT_LIBRARY_HOST)
      resolve(new elastic.Client({host: process.ENV.BUGGY_COMPONENT_LIBRARY_HOST}))
    } else {
      if (fs.existsSync(__dirname + '/.download/elastic') && fs.existsSync(__dirname + '/.download/elastic/bin/elasticsearch')) {
        console.log('elastic server instance found locally')
      } else {
        new Download({mode: 777})
          .get('https://download.elasticsearch.org/elasticsearch/release/org/elasticsearch/distribution/tar/elasticsearch/2.2.0/elasticsearch-2.2.0.tar.gz')
          .dest(__dirname + '/.download')
          .run((err, files) => {
            if (err) {
              console.error('Error while downloading elasticsearch', err)
            } else {
              console.log('Downloaded ', files[0].path)
              fs.createReadStream(files[0].path)
                .pipe(zlib.createGunzip())
                .pipe(tar.Extract({path: __dirname + '/.download/elastic', strip: 1}))
            }
          })
      }
    }
  })
}


establishConnection().then(() => {
  client.ping()
    .then(function () {
      console.log('successful pinged')
    })
    .catch(function () {
      console.log('could not ping elastic server')
    })
})

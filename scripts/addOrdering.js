
import connect from '../src/api'
import path from 'path'
import fs from 'fs'
import program from 'commander'
import _ from 'lodash'
import semver from 'semver'

var server = ''
var defaultElastic = ' Defaults to BUGGY_COMPONENT_LIBRARY_HOST'

program
  .version(JSON.parse(fs.readFileSync(path.join(__dirname, '/../package.json')))['version'])
  .option('-e, --elastic <host>', 'The elastic server to connect to.' + defaultElastic, String, server)
  .parse(process.argv)

var client = connect(program.elastic, program.prefix)

var nodes = {}

const putNode = (node) => {
  if (node.inputPorts || node.outputPorts) {
    if (!_.has(nodes, node.id) || semver.lt(nodes[node.id].version, node.version)) {
      nodes[node.id] = node
    }
  }
}


const updateItems = (start, chunkSize) => {
  return client.queryAll({limit: chunkSize, offset: start})
    .then((res) => _.each(res, putNode))
    .then((res) => {
      if (res.length > 0) {
        return updateItems(start + chunkSize, chunkSize)
      }
    })
    .catch((err) => console.error(err))
}

updateItems(0, 20)
.then(() => {
  return Promise.all(_(nodes)
    .reject((node) => node.settings && node.settings.argumentOrdering)
    .map((node) => {
      node.version = semver.inc(node.version, 'minor')
      console.log('updating ', node.id, 'to version', node.version)
      return client.insert(node) // insert will update the ordering automatically in newer versions
    }))
})
.then(() => {
  console.log('updated nodes')
})
.catch((err) => {
  console.error(err.stack)
})

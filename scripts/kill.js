var cp = require('child_process')
var psTree = require('ps-tree')
var _ = require('lodash')

export default function kill (pid, signal = 'SIGTERM') {
  return new Promise((resolve, reject) => {
    psTree(pid, (err, children) => {
      children = _.union(children, [{PID: pid}])
      if (err) {
        reject(err)
        return
      }
      const kill = cp.spawn('kill', ['-' + signal].concat(children.map(function (p) { return p.PID })))
      kill.on('close', () => {
        resolve()
      })
    })
  })
}

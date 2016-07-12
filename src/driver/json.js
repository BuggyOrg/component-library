
import jq from 'json-query'

function toQueryPath (path) {
  return path.replace(/\//g, '.')
}

function query (jqPath, data) {
  var res = jq(toQueryPath(jqPath), {data})
  if (res.value == null) {
    throw new Error('Cannot query: ' + jqPath)
  }
  return res
}

function value (jqValue) {
  return jqValue.value
}

export function getConfig (data, cfg) {
  return value(query(`config/${cfg}`, data))
}

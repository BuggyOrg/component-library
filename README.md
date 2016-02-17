# Buggy/Component Library

[![Build Status](https://travis-ci.org/BuggyOrg/component-library.svg)](https://travis-ci.org/BuggyOrg/component-library)

The component library is a client for an elastic search component collection. It can store nodes and meta information for
Buggy nodes.

# Installation

Via npm:

```
npm install @buggyorg/component-library
```

# Usage

You can either use the CLI that is installed as `buggy-library` or the API.

## CLI

```
Commands

get
  Usage: buggy-library get [options] <node-id> [version]

  Get a node document by the id of the node. If the version is not specified it prints automatically the latest version

insert
  Usage: `buggy-library insert [options]` or `echo '{ "id": "nodeID", "version": "1.0.0" }' | buggy-library insert [options]` 

  Add a node to the component library. It opens an editor (env EDITOR) window or you can pipe the node into it.

query
  Usage: buggy-library query [options] <name>

  Query detailed information for a specific component. This command can be used to search nodes.

get-code
  Usage: buggy-library get-code [options] <node-id> <language> [version]

  Get the implementation of a node in the specified language

set-code
  Usage: `buggy-library set-code [options] <node-id> <language> [version]` or `echo '<code>' | buggy-library set-code [options] <node-id> <language> [version]

  Add set code for a node in a specific programming language. It opens an editor (env EDITOR) window or you can pipe the code into it.

get-meta
  Usage: buggy-library get-meta [options] <node-id> [key] [version]

  Get the meta information for a node by id.

  Options:

    -h, --help                   output usage information
    -k, --key <key>              The meta key to query. If you don't provide a key it will print all meta information for the node
    -v, --version <nodeVersion>  The version of the node. If the version is not specified it sets the meta information on the latest version.

set-meta
  Usage: buggy-library set-meta [options] <node-id> <key> [version]

  Set the meta information (as json) for a node for a specific key. It opens an editor (env EDITOR) window or you can pipe the json document into it. If the version is not specified it sets the meta information on the latest version.

All commands have the following options

  Options:

    -h, --help             output usage information
    -V, --version          output the version number
    -e, --elastic <host>   The elastic server to connect to. Defaults to BUGGY_COMPONENT_LIBRARY_HOST or if not set to http://localhost:9200
    -p, --prefix <prefix>  Prefixes the database indices.
    -s, --silent           Only print data no further information.
```

## API

You can import the package which exports a connect function like this.

```
import libConnection from  '@buggyorg/component-library'

var api = libConnection('localhost:9200')
```

This returns the following API:

| Function                                                                   | Description                                                                                                                                                                                                                                                                                                                                                          |
|----------------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| `isConnected()`                                                            |  Returns a promise that provides a boolean indicating the server status.                                                                                                                                                                                                                                                                                             |
| `query(name: string)`                                                      | Query detailed information for a specific component. This command can be used to search nodes.                                                                                                                                                                                                                                                                       |
| `list(nodeId: string)`                                                     | Lists all nodes of all versions of a node by nodeId.                                                                                                                                                                                                                                                                                                                 |
| `get(nodeId: string, version: string)`                                     | Get a specific node by version. The nodeId is a string and the version a semver formatted string.                                                                                                                                                                                                                                                                    |
| `versions(nodeId: string)`                                                 | Lists all versions of a node by nodeId.                                                                                                                                                                                                                                                                                                                              |
| `insert(node: json, copyMetadata=true)`                                    | Inserts a new node / a new version of a node. The json document must have a key `id` of type string that does not contain the character '@' and a key `version` which must be a valid semver version. The insert method usually copies all meta information from the nearest earlier version (see `semver.lt`) if there is one such node and `copyMetadata` is true. |
| `getMeta(nodeId: string, version: string, key: string)`                    | Gets the meta information for a specific key by `nodeId` and `version`. The key specifies the meta information like `code/golang`.                                                                                                                                                                                                                                   |
| `getAllMeta(nodeId: string, version: string)`                              | Get a list of all meta data entries of a node specified by the `nodeId` and the `version`.                                                                                                                                                                                                                                                                           |
| `setMeta(nodeId: string, version: string, key: string, meta: any)`         |  Set the meta information of a node specified by `nodeId` and `version`.  The `key` specifies the meta information like `code/golang`. The value `meta` contains the data which can be of any type that is `JSON.stringify`able.                                                                                                                                     |
| `getCode(nodeId: string, version: string, language: string)`               | Get the code for a node `nodeId` and a version `version` for the language `language`. This calls the `getMeta` function and is only for ease of use. It uses `code/<language>` as the meta key.                                                                                                                                                                      |
| `setCode(nodeId: string, version: string, language: string, code: string)` | Set the code for a node `nodeId` and a version `version` for the language `language` to `code`. This calls the `setMeta` function and is only for ease of use. It uses `code/` as the meta key.                                                                                                                                                                      |
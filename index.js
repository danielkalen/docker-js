const imageMgr = require('./lib/image-mgr.js');
const compose = require('./lib/docker-composer.js');
const docker = require('./lib/docker.js');
const utils = require('./lib/docker-utils.js');

const api = {
  compose,
  imageMgr,
  docker,
  utils };

module.exports = api;

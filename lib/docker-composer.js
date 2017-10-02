const yaml = require('js-yaml');
const utils = require('./utils');
const _ = require('underscore');
const docker = require('./docker');
const execa = require('execa');
const path = require('path');
const os = require('os');
const fs = require('fs');


function generate(data) {
  return yaml.dump(data);
}
// Complete docker-compose execution
function compose(command, callback, notifyCallback) {
  const pid = utils.cmd(
   `cd ${exports.DIR}; docker-compose ${command}`,
    callback);

  if (notifyCallback && typeof notifyCallback === 'function') {
    utils.docker_logs(pid, notifyCallback);
  }
  return pid;
}

function cp(service, src, dst, callback) {
  getID(service, (err, data) => {
  // No err : get containerID = data
    if (!err) {
      const containerID = data;
      // Cal docker exec
      return docker.cp(containerID, src, dst, callback);
    }
    else {
      callback(err);
      return null;
    }
  });
}

function exec(service, command, callback, paramsInput, notifyCallback) {
  // Used for store possible errors
  let dataLine = '';
  const paramsProto = {
    detached: false,
  };
  let pid;
  // Get the params
  const params = _.extend({}, paramsProto, paramsInput);
  // Detached for Linux and mac
  if (os.platform() !== 'win32' && !params.detached) {
    pid = compose(`exec ${service} ${command}`, (err, data) => {
      if (err)
      {
        // Override old existent error
        let stringErr = `Error occurred: ${err.message}.`;
        if (dataLine !== '') {
          stringErr += `DOCKER GIVES: ${dataLine}`;
        }
        callback(new Error(stringErr));
      }
      else callback(null, data);
    });
    // Capture possible errors
    utils.docker_logs_stdout(pid, (dl) => {
      dataLine += dl;
    });
    utils.docker_logs_stdout(pid, notifyCallback);
  }
  // Workaround for detached mode docker-compose and windows-mode
  else {
    getID(service, (err, data) => {
      // No err : get containerID = data
      if (!err) {
        const containerID = data;
      // Cal docker exec
        pid = docker.exec(containerID, command, callback, params);
        utils.docker_logs_stdout(pid, notifyCallback);
      }
      else callback(err);
    });
  }
}

function isRunning(callback) {
  compose('ps -q', (err, data) => {
    if (err) callback(err);
    else if (data === '') callback(null, false);
    else callback(null, true);
  });
}

function getID(service, callback) {
  return compose(`ps -q ${service}`, (err, data) => {
    if (err) {
      callback(err, data);
    }
    else {
      let containerID = data;
      // Replace newlines
      containerID = containerID.replace(/(\r\n|\n|\r)/gm, '');
      callback(null, containerID);
    }
  });
}

function getCommandArgs(args){
  if (typeof args[0] === 'function') {
    return {target:'', callback:args[0], notify:args[1]};
  }
  if (typeof args[0] === 'string') {
    return {target:args[0], callback:args[1], notify:args[2]};
  }
}

function up() {
  ({target, callback, notify} = getCommandArgs(arguments));
  return compose(`up -d ${target}`, callback, notify);
}

function down() {
  ({target, callback, notify} = getCommandArgs(arguments));
  return compose(`down ${target}`, callback, notify);
}

function start() {
  ({target, callback, notify} = getCommandArgs(arguments));
  return compose(`start ${target}`, callback, notify);
}

function stop() {
  ({target, callback, notify} = getCommandArgs(arguments));
  return compose(`stop ${target}`, callback, notify);
}

function restart() {
  ({target, callback, notify} = getCommandArgs(arguments));
  return compose(`restart ${target}`, callback, notify);
}

function names(callback) {
  return compose(`config --services`, function(err, result){
    if (err) callback(err);
    else callback(null, result.trim().split(/\s+/));
  });
}

function version(callback) {
  return compose(`version`, callback);
}

function logs(target, config, callback) {
  if (typeof target === 'object') {
    callback = config
    config = target
    target = ''
  } else if (typeof target === 'function') {
    callback = target
    config = {}
    target = ''
  } else if (typeof config === 'function') {
    callback = config
    config = {}
  }

  var configString = '';
  if (config.follow) configString += ` -f`;
  if (config.time) configString += ` -t`;
  if (config.tail) configString += ` --tail=${config.tail}`;
  if (config.noColor) configString += ` --no-color`;
  
  function notify(data){
    if (typeof target === 'string') {
      callback(null, formatLogsOutput(data, target));
    } else {
      callback(null, data);
    }
  };
  
  var spawn = compose(`logs ${configString} ${target}`, function(err, output){
    if (err) return callback(err)
    notify(output.split('\n').slice(1).join('\n'))
  });

  if (config.follow) {
    spawn.stdout.on('data', notify);
    spawn.stderr.on('data', notify);
  }
  return spawn;
}

function formatLogsOutput(data, service) {
  var regex = new RegExp(`${service}(?:_\\d+)?\\s+\\| ?`);
  return data
    .split('\n')
    .map(function(line){
      return line.replace(regex, '');
    })
    .join('\n')
}

exports.DIR = process.env.COMPOSE_CWD || path.resolve();
exports._run = compose;
exports.generate = generate;
exports.up = up;
exports.down = down;
exports.start = start;
exports.stop = stop;
exports.restart = restart;
exports.names = names;
exports.version = version;
exports.logs = logs;
exports.exec = exec;
exports.cp = cp;
exports.getID = getID;
exports.isRunning = isRunning;
require('bluebird').promisifyAll(module.exports);

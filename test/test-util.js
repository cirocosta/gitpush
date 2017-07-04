const fs = require('fs');
const path = require('path');
const tempy = require('tempy');
const logger = require('debug')('gpusher:test');
const {spawn} = require('child_process');

function initDirs() {
  const dirs = {
    repo: tempy.directory(),
    src: tempy.directory(),
    dst: tempy.directory(),
    target: tempy.directory(),
  };

  logger('dirs: %O', dirs);

  return dirs;
}

function run(command) {
  const args = command.split(' ');
  const proc = spawn(args.shift(), args, {
    shell: true,
  });

  let result = '';

  return new Promise((resolve, reject) => {
    proc.stdout.on('data', d => (result += d.toString()));
    proc.stderr.on('data', d => (result += d.toString()));
    proc.on('close', code => {
      if (!code) {
        logger(result);
        return resolve(result);
      }

      reject(new Error(`Execution of [${command}] failed with code ${code}`));
    });
  });
}

module.exports = {
  run,
  initDirs,
};

const fs = require('fs');
const path = require('path');
const logger = require('debug')('pushover:test');
const {tmpdir} = require('os');
const {spawn} = require('child_process');

function initDirs() {
  const repo = path.join(
    tmpdir(),
    Math.floor(Math.random() * (1 << 30)).toString(16)
  );
  const src = path.join(
    tmpdir(),
    Math.floor(Math.random() * (1 << 30)).toString(16)
  );
  const dst = path.join(
    tmpdir(),
    Math.floor(Math.random() * (1 << 30)).toString(16)
  );
  const target = path.join(
    tmpdir(),
    Math.floor(Math.random() * (1 << 30)).toString(16)
  );

  fs.mkdirSync(repo, 0700);
  fs.mkdirSync(src, 0700);
  fs.mkdirSync(dst, 0700);
  fs.mkdirSync(target, 0700);

  logger('repo: %s', repo);
  logger('src : %s', src);
  logger('dst : %s', dst);
  logger('trgt: %s', target);

  return {repo, src, dst, target};
}

function run(command) {
  const args = command.split(' ');
  const proc = spawn(args.shift(), args);

  let result = '';

  return new Promise((resolve, reject) => {
    proc.stdout.on('data', d => (result += d.toString()));
    proc.stderr.on('data', d => (result += d.toString()));
    proc.on('close', code => {
      if (!code) {
        logger(result);
        return resolve(result);
      }

      reject(new Error(`Execution failed with code ${code}`));
    });
  });
}

module.exports = {
  run,
  initDirs
};

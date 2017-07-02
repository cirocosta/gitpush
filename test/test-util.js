const logger = require('debug')('pushover:test');
const {spawn} = require('child_process');

function run(command) {
  const args = command.split(' ');
  const proc = spawn(args.shift(), args);

  let result = '';

  return new Promise((resolve, reject) => {
    proc.stdout.on('data', (d) => result += d.toString());
    proc.stderr.on('data', (d) => result += d.toString());
    proc.on('close', (code) => {
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
};


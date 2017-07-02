const logger = require('debug')('pushover:test');
const pushover = require('../');
const fs = require('fs');
const path = require('path');
const exists = fs.exists || path.exists;
const http = require('http');
const { test}  = require('tap');
const { tmpdir } = require('os');
const { run } = require('./test-util.js');

const repoDir = path.join(tmpdir(), Math.floor(Math.random() * (1<<30)).toString(16));
const srcDir = path.join(tmpdir(), Math.floor(Math.random() * (1<<30)).toString(16));
const dstDir = path.join(tmpdir(), Math.floor(Math.random() * (1<<30)).toString(16));
const targetDir = path.join(tmpdir(), Math.floor(Math.random() * (1<<30)).toString(16));

fs.mkdirSync(repoDir, 0700);
fs.mkdirSync(srcDir, 0700);
fs.mkdirSync(dstDir, 0700);
fs.mkdirSync(targetDir, 0700);


logger('repoDir: %s', repoDir);
logger('srcDir: %s', srcDir);
logger('dstDir: %s', dstDir);
logger('targetDir: %s', targetDir);

let port = 3000;

test('clone into programatic directories', async (t) => {
  let repos = pushover((dir) => {
      t.equal(dir, 'doom.git');
      return path.join(targetDir, dir);
  });

  repos.on('push', (push) => {
      t.equal(push.repo, 'doom.git');
      push.accept();
  });

  let server = http.createServer(repos.handle.bind(repos));
  server.listen(port, '127.0.0.1');

  process.chdir(srcDir);

  await run(`git init`);
  fs.writeFileSync(srcDir + '/a.txt', 'abcd');
  await run(`git add a.txt`);
  await run(`git commit -am 'a!!'`);
  await run(`git push http://127.0.0.1:${port}/doom.git master`);

  process.chdir(dstDir);
  await run(`git clone http://127.0.0.1:${port}/doom.git`);
  t.ok(fs.existsSync(dstDir + '/doom/a.txt'));
  t.ok(fs.existsSync(targetDir + '/doom.git/HEAD'));
    
  server.close();
  t.end();
});

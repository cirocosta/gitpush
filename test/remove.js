const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('debug')('gpusher:test');
const gpusher = require('../');
const sideband = require('git-side-band-message');
const tempy = require('tempy');

const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

const dirs = initDirs();
const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

test('create, push to, and clone a repo', async t => {
  let repos = gpusher(dirs.repo, {autoCreate: false});
  let server = http.createServer((req, res) => {
    repos.handle(req, res);
  });

  server.listen(port, '127.0.0.1');
  process.chdir(dirs.src);
  repos.create('doom', this);

  await run('git init');

  fs.writeFileSync(`${dirs.src}/a.txt`, 'abcd');
  await run('git add a.txt');
  await run('git commit -am a!!');
  await run(`git push http://127.0.0.1:${port}/doom.git master`);

  await new Promise((res, rej) => {
    repos.remove('doom', err => {
      if (err) {
        return rej(err);
      }
      res(err);
    });
  });

  process.chdir(dirs.dst);
  try {
    await run(`git clone http://127.0.0.1:${port}/doom.git`);
    t.notOk(true, 'clone should have failed');
  } catch (err) {
    t.ok(true);
  }

  server.close();
  t.end();
});

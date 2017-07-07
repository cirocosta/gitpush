const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('debug')('gpusher:test');
const gpusher = require('../');

const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

test('can reject a clone of empty repo - info', async t => {
  const dirs = initDirs();
  const repos = gpusher(dirs.repo, {autoCreate: false});
  const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

  repos.on('info', info => {
    info.reject();
  });

  let server = http.createServer((req, res) => {
    repos.handle(req, res);
  });

  server.listen(port, '127.0.0.1');
  repos.create('doom', this);

  process.chdir(dirs.dst);
  try {
    let res = await run(`git clone http://127.0.0.1:${port}/doom.git master`);
    console.log(res);
    t.notOk(true);
  } catch (err) {}

  server.close();
  t.end();
});

test('can reject a clone of non-empty repo - fetch', async t => {
  const dirs = initDirs();
  const repos = gpusher(dirs.repo, {autoCreate: false});
  const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

  repos.on('fetch', fetch => {
    fetch.reject();
  });

  let server = http.createServer((req, res) => {
    repos.handle(req, res);
  });

  server.listen(port, '127.0.0.1');
  repos.create('doom', this);

  process.chdir(dirs.src);
  await run('git init');
  fs.writeFileSync(`${dirs.src}/a.txt`, 'abcd');
  await run('git add a.txt');
  await run('git commit -am a!!');
  await run(`git push http://127.0.0.1:${port}/doom.git master`);

  process.chdir(dirs.dst);
  try {
    let res = await run(`git clone http://127.0.0.1:${port}/doom.git master`);
    console.log(res);
    t.notOk(true);
  } catch (err) {}

  server.close();
  t.end();
});

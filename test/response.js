const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('debug')('gpusher:test');
const gpusher = require('../');
const sideband = require('git-side-band-message');

const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

const dirs = initDirs();
const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;


test('create, push to, and clone a repo', async t => {
  let repos = gpusher(dirs.repo, {autoCreate: false});
  repos.on('push', push => {
    t.equal(push.headers.host, '127.0.0.1:' + port, 'http host');
    t.equal(push.method, 'POST', 'is a post');
    t.equal(push.url, '/doom.git/git-receive-pack', 'receive pack');

    push.on('response', (res, done) => {
      res.write(sideband('hueee'));
      done();
    });

    push.accept();
  });

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
  let resp = await run(`git push http://127.0.0.1:${port}/doom.git master`);
  t.ok(resp.indexOf('remote: hueee') != -1);

  server.close();
  t.end();
});

const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('debug')('gpusher:test');
const gpusher = require('../');

const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

const dirs = initDirs();
const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

test('create, push to, and clone a repo', async t => {
  let repos = gpusher(dirs.repo, {autoCreate: false});
  let lastCommit;

  repos.on('push', push => {
    t.equal(push.repo, 'xyz/doom.git', 'repo name');
    t.equal(push.commit, lastCommit, 'commit ok');
    t.equal(push.branch, 'master', 'master branch');

    t.equal(push.headers.host, `127.0.0.1:${port}`, 'http host');
    t.equal(push.method, 'POST', 'is a post');
    t.equal(push.url, '/xyz/doom.git/git-receive-pack', 'receive pack');

    push.accept();
  });

  let server = http.createServer(repos.handle.bind(repos));
  server.listen(port, '127.0.0.1');

  process.chdir(dirs.src);
  repos.mkdir('xyz', this);
  repos.create('xyz/doom.git', this);

  await run('git init');
  fs.writeFileSync(`${dirs.src}/a.txt`, 'abcd');
  await run('git add a.txt');
  await run('git commit -am a!!');

  let gitLog = await run(`git log | head -n1`);
  lastCommit = gitLog.split(/\s+/)[1];

  await run(`git push http://127.0.0.1:${port}/xyz/doom.git master`);

  process.chdir(dirs.dst);
  await run(`git clone http://127.0.0.1:${port}/xyz/doom.git`);

  t.ok(fs.existsSync(dirs.dst + '/doom/a.txt'));
  server.close();

  t.end();
});

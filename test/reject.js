const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('debug')('gitpush:test');
const gitpush = require('../');

const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

const dirs = initDirs();
const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

test('create, push to, and clone a repo', async t => {
  let lastCommit = '';
  let repos = gitpush(dirs.repo, {autoCreate: false});

  repos.on('push', function(push) {
    t.equal(push.repo, 'doom.git', 'repo name');
    t.equal(push.commit, lastCommit, 'commit ok');
    t.equal(push.branch, 'master', 'master branch');

    t.equal(push.headers.host, '127.0.0.1:' + port, 'http host');
    t.equal(push.method, 'POST', 'is a post');
    t.equal(push.url, '/doom.git/git-receive-pack', 'receive pack');

    push.reject(500, 'ACCESS DENIED');
  });

  let server = http.createServer((req, res) => {
    repos.handle(req, res);
  });

  server.listen(port, '127.0.0.1');

  t.on('end', () => {
    server.close();
  });

  process.chdir(dirs.src);

  repos.create('doom', this);
  await run('git init');
  fs.writeFileSync(`${dirs.src}/a.txt`, 'abcd');
  await run('git add a.txt');
  await run('git commit -am a!!');
  let stdout = await run('git log | head -n1');
  lastCommit = stdout.split(/\s+/)[1];

  try {
    await run(`git push http://127.0.0.1:${port}/doom.git master`);
    t.notOk(true);
  } catch (err) {}

  try {
    await run('git', ['log'], {cwd: repoDir + '/doom.git'});
    t.notOk(true);
  } catch (err) {}
});

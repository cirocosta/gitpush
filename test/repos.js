const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('debug')('pushover:test');
const pushover = require('../');

const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

const dirs = initDirs();
const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

test('create, push to, and clone a repo', async t => {
  let lastCommit = '';
  let firstTag = true;

  let repos = pushover(dirs.repo, {autoCreate: false});
  repos.on('push', push => {
    t.equal(push.repo, 'doom.git', 'repo name');
    t.equal(push.commit, lastCommit, 'commit ok');
    t.equal(push.branch, 'master', 'master branch');

    t.equal(push.headers.host, '127.0.0.1:' + port, 'http host');
    t.equal(push.method, 'POST', 'is a post');
    t.equal(push.url, '/doom.git/git-receive-pack', 'receive pack');

    push.accept();
  });

  repos.on('tag', function(tag) {
    t.equal(tag.repo, 'doom.git', 'repo name');
    t.equal(tag.version, '0.0.' + (firstTag ? 1 : 2), 'tag received');

    t.equal(tag.headers.host, '127.0.0.1:' + port, 'http host');
    t.equal(tag.method, 'POST', 'is a post');
    t.equal(tag.url, '/doom.git/git-receive-pack', 'receive pack');

    tag.accept();
    firstTag = false;
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
  await run('git tag 0.0.1');

  fs.writeFileSync(`${dirs.src}/a.txt`, 'efgh');
  await run('git add a.txt');
  await run('git commit -am b!!');

  let stdout = await run('git log | head -n1');
  lastCommit = stdout.split(/\s+/)[1];
  await run('git tag 0.0.2');

  await run(`git push --tags http://127.0.0.1:${port}/doom.git master`);

  process.chdir(dirs.dst);
  await run(`git clone http://127.0.0.1:${port}/doom.git`);
  t.ok(fs.existsSync(`${dirs.dst}/doom/a.txt`));

  server.close();
  t.end();
});

const fs = require('fs');
const path = require('path');
const http = require('http');
const logger = require('debug')('pushover:test');
const pushover = require('../');

const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

const dirs = initDirs();
const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

test('clone into programatic directories', async t => {
  let repos = pushover(dir => {
    t.equal(dir, 'doom.git');
    return path.join(dirs.target, dir);
  });

  repos.on('push', push => {
    t.equal(push.repo, 'doom.git');
    push.accept();
  });

  let server = http.createServer(repos.handle.bind(repos));
  server.listen(port, '127.0.0.1');

  process.chdir(dirs.src);

  await run(`git init`);
  fs.writeFileSync(`${dirs.src}/a.txt`, 'abcd');
  await run(`git add a.txt`);
  await run(`git commit -am 'a!!'`);
  await run(`git push http://127.0.0.1:${port}/doom.git master`);

  process.chdir(dirs.dst);
  await run(`git clone http://127.0.0.1:${port}/doom.git`);
  t.ok(fs.existsSync(`${dirs.dst}/doom/a.txt`));
  t.ok(fs.existsSync(`${dirs.target}/doom.git/HEAD`));

  server.close();
  t.end();
});

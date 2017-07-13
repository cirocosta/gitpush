const logger = require('debug')('gpusher:test');
const gpusher = require('../');
const fs = require('fs');
const path = require('path');
const http = require('http');

const {tmpdir} = require('os');
const {test} = require('tap');
const {run, initDirs} = require('./test-util.js');

const dirs = initDirs();
const port = Math.floor(Math.random() * ((1 << 16) - 1e4)) + 1e4;

test('subsequent pushes', async t => {
  let repos = gpusher(dirs.repo);
  let pushes = 0;

  repos.on('push', push => {
    pushes++;
    push.accept();
  });

  let server = http.createServer(repos.handle.bind(repos));

  server.listen(port, '127.0.0.1');
  process.chdir(dirs.src);

  await run(`git init`);
  fs.writeFileSync(`${dirs.src}/a.txt`, 'abcd');
  await run(`git add a.txt`);
  await run(`git commit -am 'a!!'`);
  await run(`git push http://127.0.0.1:${port}/doom master`);
  await run(`git push http://127.0.0.1:${port}/doom master`);
  await run(`git push http://127.0.0.1:${port}/doom master`);
  await run(`git push http://127.0.0.1:${port}/doom master`);

  t.equal(1, pushes);
  server.close();

  t.end();
});

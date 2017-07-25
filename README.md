<h1 align="center">gpusher 📝  </h1>

<h5 align="center">Git over HTTP with Push and Fetch Events</h5>

<br/>

> Fork of [substack/pushover](https://github.com/substack/pushover) and [strongloop-forks/strong-fork-pushover](https://github.com/strongloop-forks/strong-fork-pushover)

`gpusher` allows one to have control as a middleware between `git` and the `http` transport. It does so by providing `*.git/*` routes over `(req,res)`, executing rpc calls to git and then streaming back the response of such calls.


### Quickstart

Fetch the package:

```
npm i gpusher
```

set up the handler:

```js
const express = require('express');
const gpusher = require('gpusher');

const port = 8000;
const app = express();
const repos = gpusher('/tmp/gpusher');

repos.on('push', p => {
  console.log(
    'branch=%s\nrepo=%s\ncommit=%s',
    p.branch, p.commit, p.repo,
  );
  p.accept();
});

app.all('/*', repos.handle.bind(repos)); 

app.listen(port, () => {
  console.log('listening on %d', port);
});
```

Clone a repository:


```sh
git clone http://localhost:8000/myrepo
```

Push something to there:

```sh
cd myrepo
echo "hue" > file.txt
git add --all .
git commit -m 'something'
git push origin master
```

See the output in the server `stdout`:

```sh
listening on 8000
branch=master
repo=8788e1576ba150daeff969e74107a9ffbfa20b1c
commit=myrepo
```


### Use cases

#### Rate-limiting big pushes

The `handle` function takes three arguments, being the last one an optional `opts` mapping:

```
function handle (req, res, opts);
```

where `opts` can take the following values:

```
// a function that takes a repository (string) and returns
// a `through` function that takes a chunk and then decides what 
// to do with it. In order to forward the chunk into the next pipe
// just `this.queue(chunk)`;
opts.transform = function (repo) { 
  // return a `through` function
  return function (chunk) { 
    this.queue(chunk);
  }
}
```

This `transform` method creator allows one to inject code into the pipe stream from `request` to `git rpc` sitting right after the `decoding` phase (when `gzip` decoder is sending bytes ahead).

This way one can create a rate-limiter:


  let server = http.createServer((req, res) => {
    return function rateLimitter(repo) {
      let limit = 1024;
      return function bytesCounter(chunk) {
        limit -= chunk.length;
        if (limit > 0) {
          return this.queue(chunk);
        }

        this.emit('error', new Error('quota limit reached'));
      };
    }

    repos.handle(req, res, {
      transform: rateLimitter,
    });
  });



#### Performing a request and streaming the response to the client

```js
const fs = require('fs');
const http = require('http');

const request = require('request');
const gpusher = require('gpusher');
const through2 = require('through2');
const sideband = require('git-side-band-message');

const repos = gpusher('/tmp/repositories');

repos.on('push', push => {
  console.log('push');

  push.on('response', (res, done) => {
    // this is a 3MB+ stream from 1 to 575286
    request('https://dl.filla.be/aiTJodJ_k')
      .pipe(
        through2((chunk, enc, cb) => {
          console.log('writing chunk');
          res.write(sideband(chunk));
          cb();
        })
      )
      .on('finish', () => {
        console.log('finish');
        done();
      });
  });

  console.log('push accepted');
  push.accept();
});

http
  .createServer((req, res) => {
    repos.handle(req, res);
  })
  .listen(8000);
```


[![Build Status](https://travis-ci.org/cirocosta/gpusher.svg?branch=master)](https://travis-ci.org/cirocosta/gpusher)


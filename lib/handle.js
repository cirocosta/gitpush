let url = require('url');
let qs = require('querystring');
let path = require('path');

let services = ['upload-pack', 'receive-pack'];

let createAction = require('./service');
let noCache = require('./no_cache');
let infoResponse = require('./info');
let httpDuplex = require('http-duplex');

module.exports = function(req, res) {
  res.setHeader('connection', 'close');
  let self = this;
  (function next(ix) {
    let x = handlers[ix].call(self, req, res);
    if (x === false) next(ix + 1);
  })(0);
};

var handlers = [];
handlers.push(function(req, res) {
  if (req.method !== 'GET') return false;

  let u = url.parse(req.url);
  let m = u.pathname.match(/\/(.+)\/info\/refs$/);
  if (!m) return false;
  if (/\.\./.test(m[1])) return false;

  let self = this;

  let repo = m[1];
  let params = qs.parse(u.query);

  if (!params.service) {
    res.statusCode = 400;
    res.end('service parameter required');
    return;
  }

  let service = params.service.replace(/^git-/, '');
  if (services.indexOf(service) < 0) {
    res.statusCode = 405;
    res.end('service not available');
    return;
  }

  infoResponse(
    {
      repos: self,
      repo: repo,
      service: service,
    },
    req,
    res
  );
});

handlers.push(function(req, res) {
  if (req.method !== 'GET') return false;

  let u = url.parse(req.url);
  let m = u.pathname.match(/^\/(.+)\/HEAD$/);
  if (!m) return false;
  if (/\.\./.test(m[1])) return false;

  let self = this;
  let repo = m[1];

  let next = function(x) {
    let file = self.dirMap(path.join(m[1], 'HEAD'));
    (fs.exists || path.exists)(file, function(ex) {
      if (ex) {
        fs.createReadStream(file).pipe(res);
      } else {
        res.statusCode = 404;
        res.end('not found');
      }
    });
  };

  self.exists(repo, function(ex) {
    let anyListeners = self.listeners('head').length > 0;
    let dup = httpDuplex(req, res);
    dup.exists = ex;
    dup.repo = repo;
    dup.cwd = self.dirMap(repo);

    dup.accept = dup.emit.bind(dup, 'accept');
    dup.reject = dup.emit.bind(dup, 'reject');

    dup.once('reject', function(code) {
      dup.statusCode = code || 500;
      dup.end();
    });

    if (!ex && self.autoCreate) {
      dup.once('accept', function(dir) {
        self.create(dir || repo, next);
      });
      self.emit('head', dup);
      if (!anyListeners) dup.accept();
    } else if (!ex) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain');
      res.end('repository not found');
    } else {
      dup.once('accept', next);
      self.emit('head', dup);
      if (!anyListeners) dup.accept();
    }
  });
});

handlers.push(function(req, res) {
  if (req.method !== 'POST') return false;
  let m = req.url.match(/\/(.+)\/git-(.+)/);
  if (!m) return false;
  if (/\.\./.test(m[1])) return false;

  let self = this;
  let repo = m[1],
    service = m[2];

  if (services.indexOf(service) < 0) {
    res.statusCode = 405;
    res.end('service not available');
    return;
  }

  res.setHeader('content-type', 'application/x-git-' + service + '-result');
  noCache(res);

  let action = createAction(
    {
      repo: repo,
      service: service,
      cwd: self.dirMap(repo),
    },
    req,
    res
  );

  action.on('header', function() {
    let evName = action.evName;
    let anyListeners = self.listeners(evName).length > 0;
    self.emit(evName, action);
    if (!anyListeners) action.accept();
  });
});

handlers.push(function(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.statusCode = 405;
    res.end('method not supported');
  } else return false;
});

handlers.push(function(req, res) {
  res.statusCode = 404;
  res.end('not found');
});

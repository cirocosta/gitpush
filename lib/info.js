let httpDuplex = require('http-duplex');
let spawn = require('child_process').spawn;

let noCache = require('./no_cache');
let onexit = require('./onexit');

module.exports = function(opts, req, res) {
  let self = opts.repos;
  let dup = httpDuplex(req, res);
  dup.cwd = self.dirMap(opts.repo);
  dup.repo = opts.repo;

  dup.accept = dup.emit.bind(dup, 'accept');
  dup.reject = dup.emit.bind(dup, 'reject');

  dup.once('reject', function(code) {
    res.statusCode = code || 500;
    res.end();
  });

  let anyListeners = self.listeners('info').length > 0;

  self.exists(opts.repo, function(ex) {
    dup.exists = ex;

    if (!ex && self.autoCreate) {
      dup.once('accept', function() {
        self.create(opts.repo, next);
      });

      self.emit('info', dup);
      if (!anyListeners) dup.accept();
    } else if (!ex) {
      res.statusCode = 404;
      res.setHeader('content-type', 'text/plain');
      res.end('repository not found');
    } else {
      dup.once('accept', next);
      self.emit('info', dup);

      if (!anyListeners) dup.accept();
    }
  });

  function next() {
    res.setHeader(
      'content-type',
      'application/x-git-' + opts.service + '-advertisement'
    );
    noCache(res);
    let d = self.dirMap(opts.repo);
    serviceRespond(self, opts.service, d, res);
  }
};

function serviceRespond(self, service, file, res) {
  function pack(s) {
    let n = (4 + s.length).toString(16);
    return Array(4 - n.length + 1).join('0') + n + s;
  }
  res.write(pack('# service=git-' + service + '\n'));
  res.write('0000');

  let cmd = ['git', service, '--stateless-rpc', '--advertise-refs', file];
  let ps = spawn(cmd[0], cmd.slice(1));
  ps.on('error', function(err) {
    self.emit(
      'error',
      new Error(err.message + ' running command ' + cmd.join(' '))
    );
  });
  ps.stdout.pipe(res);
}

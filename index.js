const log = require('debug')('gpusher:index');
const fs = require('fs');
const path = require('path');
const http = require('http');
const mkdirp = require('mkdirp');
const inherits = require('inherits');
const rimraf = require('rimraf');

const {spawn} = require('child_process');
const {EventEmitter} = require('events');

const onexit = require('./lib/onexit');

module.exports = function(repoDir, opts) {
  if (!opts) opts = {};
  let dirMap =
    typeof repoDir === 'function'
      ? repoDir
      : function(dir) {
          return path.join(repoDir, dir);
        };
  return new Git(dirMap, opts);
};

function Git(dirMap, opts) {
  EventEmitter.call(this);

  this.dirMap = dirMap;
  this.autoCreate = opts.autoCreate === false ? false : true;
  this.checkout = opts.checkout;
}

inherits(Git, EventEmitter);

Git.prototype.list = function(cb) {
  log('list');

  fs.readdir(this.dirMap(), cb);
};

Git.prototype.exists = function(repo, cb) {
  log('exists: %s', repo);
  (fs.exists || path.exists)(this.dirMap(repo), cb);
};

Git.prototype.mkdir = function(dir, cb) {
  log('mkdir: %s', dir);

  mkdirp(this.dirMap(dir), cb);
};

Git.prototype.remove = function(repo, cb) {
  log('remove: %s', repo);

  if (typeof cb !== 'function') {
    cb = function() {};
  }

  if (!/\.git$/.test(repo)) {
    repo += '.git';
  }

  let dir = this.dirMap(repo);
  if (fs.existsSync(dir)) {
    rimraf(dir, cb);
  } else {
    cb();
  }
};

Git.prototype.create = function(repo, cb) {
  log('create: %s', repo);

  let self = this;
  if (typeof cb !== 'function') cb = function() {};
  let cwd = process.cwd();

  if (!/\.git$/.test(repo)) repo += '.git';

  self.exists(repo, function(ex) {
    if (!ex) self.mkdir(repo, next);
    else next();
  });

  function next(err) {
    if (err) return cb(err);

    let dir = self.dirMap(repo);
    if (self.checkout) {
      var ps = spawn('git', ['init', dir]);
    } else {
      var ps = spawn('git', ['init', '--bare', dir]);
    }

    var err = '';
    ps.stderr.on('data', function(buf) {
      err += buf;
    });

    onexit(ps, function(code) {
      if (!cb) {
        return;
      }

      if (code) {
        cb(err || true);
        return;
      }

      log('create: bare init succeeded (%s)', repo);
      cb(null);
    });
  }
};

Git.prototype.handle = require('./lib/handle');

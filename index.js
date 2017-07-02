let fs = require('fs');
let path = require('path');
let http = require('http');
let mkdirp = require('mkdirp');
let inherits = require('inherits');

let spawn = require('child_process').spawn;
let EventEmitter = require('events').EventEmitter;

let onexit = require('./lib/onexit');

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
  fs.readdir(this.dirMap(), cb);
};

Git.prototype.exists = function(repo, cb) {
  (fs.exists || path.exists)(this.dirMap(repo), cb);
};

Git.prototype.mkdir = function(dir, cb) {
  mkdirp(this.dirMap(dir), cb);
};

Git.prototype.create = function(repo, cb) {
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
      } else if (code) cb(err || true);
      else cb(null);
    });
  }
};

Git.prototype.handle = require('./lib/handle');

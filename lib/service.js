const through = require('through');
const inherits = require('inherits');
const zlib = require('zlib');
const {EventEmitter} = require('events');
const {spawn} = require('child_process');

let encodings = {
  gzip: function() {
    return zlib.createGunzip();
  },
  deflate: function() {
    return zlib.createDeflate();
  },
};

module.exports = function(opts, req, res) {
  let service = new Service(opts, req, res);

  Object.keys(opts).forEach(function(key) {
    service[key] = opts[key];
  });
  return service;
};

let headerRE = {
  'receive-pack':
    '([0-9a-fA-F]+) ([0-9a-fA-F]+)' +
    ' refs/(heads|tags)/(.*?)( |00|\u0000)' +
    '|^(0000)$',
  'upload-pack': '^\\S+ ([0-9a-fA-F]+)',
};

inherits(Service, EventEmitter);

function Service(opts, req, res) {
  EventEmitter.call(this);
  let self = this;

  self.headers = req.headers;
  self.method = req.method;
  self.url = req.url;

  self.status = 'pending';
  self.repo = opts.repo;
  self.service = opts.service;
  self.cwd = opts.cwd;

  let buffered = through().pause();

  // stream needed to receive data after decoding, but before accepting
  let ts = through();

  let decoder = encodings[req.headers['content-encoding']];
  if (decoder) {
    // data is compressed with gzip or deflate
    req.pipe(decoder()).pipe(ts).pipe(buffered);
  } else {
    // data is not compressed
    req.pipe(ts).pipe(buffered);
  }

  let data = '';
  ts.once('data', function(buf) {
    data += buf;

    let ops = data.match(new RegExp(headerRE[self.service], 'gi'));
    if (!ops) return;
    data = undefined;

    ops.forEach(function(op) {
      let m = op.match(new RegExp(headerRE[self.service]));
      if (self.service === 'receive-pack') {
        self.last = m[1];
        self.commit = m[2];

        if (m[3] == 'heads') {
          var type = 'branch';
          self.evName = 'push';
        } else {
          var type = 'version';
          self.evName = 'tag';
        }

        let headers = {
          last: self.last,
          commit: self.commit,
        };
        headers[type] = self[type] = m[4];
        self.emit('header', headers);
      } else if (self.service === 'upload-pack') {
        self.commit = m[1];
        self.evName = 'fetch';
        self.emit('header', {commit: self.commit});
      }
    });
  });

  self.once('accept', function() {
    process.nextTick(function() {
      let cmd = ['git', opts.service, '--stateless-rpc', opts.cwd];
      let ps = spawn(cmd[0], cmd.slice(1));
      ps.on('error', function(err) {
        self.emit(
          'error',
          new Error(err.message + ' running command ' + cmd.join(' '))
        );
      });

      self.emit('service', ps);

      let respStream = through(
        function write(c) {
          if (self.listeners('response').length === 0) {
            return this.queue(c);
          }

          // prevent git from sending the close signal
          if (c.length === 4 && c.toString() === '0000') {
            return;
          }

          this.queue(c);
        },
        function end() {
          if (self.listeners('response').length > 0) {
            self.emit('response', respStream, endResponse);
            return;
          }
          this.queue(null);
        }
      );

      function endResponse() {
        respStream.queue(new Buffer('0000'));
        respStream.queue(null);
      }

      ps.stdout.pipe(respStream).pipe(res);

      buffered.pipe(ps.stdin);
      buffered.resume();
      ps.on('exit', self.emit.bind(self, 'exit'));
    });
  });

  self.once('reject', function(code, msg) {
    res.statusCode = code;
    res.end(msg);
  });
}

Service.prototype.accept = function(dir) {
  if (this.status !== 'pending') return;

  this.status = 'accepted';
  this.emit('accept', dir);
};

Service.prototype.reject = function(code, msg) {
  if (this.status !== 'pending') return;

  if (msg === undefined && typeof code === 'string') {
    msg = code;
    code = 500;
  }
  this.status = 'rejected';
  this.emit('reject', code || 500, msg);
};

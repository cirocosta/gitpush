module.exports = function(ps, cb) {
  let pending = 3;
  let code, sig;

  function onend() {
    if (--pending === 0) cb(code, sig);
  }
  ps.on('exit', function(c, s) {
    code = c;
    sig = s;
  });
  ps.on('exit', onend);
  ps.stdout.on('end', onend);
  ps.stderr.on('end', onend);
};

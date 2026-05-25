const { spawn } = require('child_process');
const s = spawn('node', ['server.js'], {
  cwd: __dirname,
  detached: true,
  stdio: 'ignore'
});
s.unref();
console.log('Server PID:', s.pid);

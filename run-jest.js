const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const cwd = path.resolve(__dirname);
const outPath = path.resolve(cwd, 'jest-out.txt');

// node 検出
const NODE_PATHS = [
  process.execPath,
  'C:\\Users\\admin\\AppData\\Local\\Temp\\node\\node-v20.11.1-win-x64\\node.exe',
  'C:\\Program Files\\nodejs\\node.exe',
  'C:\\Program Files (x86)\\nodejs\\node.exe',
  process.env.LOCALAPPDATA + '\\Programs\\nodejs\\node.exe',
];
let nodeExe = null;
for (const p of NODE_PATHS) {
  if (p && fs.existsSync(p)) { nodeExe = p; break; }
}
if (!nodeExe) {
  fs.writeFileSync(outPath, 'ERROR: node.exe not found\nPossible paths:\n' + NODE_PATHS.join('\n') + '\n', 'utf8');
  console.error('node.exe not found');
  process.exit(2);
}

const args = [
  'node_modules\\jest\\bin\\jest.js',
  '--runInBand',
  '--reporter=default',
  '--colors=false',
];
const child = spawn(nodeExe, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
let stdout = '';
let stderr = '';
child.stdout.on('data', d => { stdout += d.toString('utf8'); });
child.stderr.on('data', d => { stderr += d.toString('utf8'); });
child.on('error', err => {
  stderr += 'SPAWN ERROR: ' + err.toString() + '\n';
  finish();
});
child.on('close', code => {
  finish();
});
let finished = false;
function finish() {
  if (finished) return;
  finished = true;
  const combined = '--- STDOUT ---\n' + stdout + '\n--- STDERR ---\n' + stderr + '\nExitCode: ' + (child.exitCode === undefined ? 'still-running' : child.exitCode) + '\n';
  fs.writeFileSync(outPath, combined, 'utf8');
  console.log('WROTE', outPath, 'bytes', fs.statSync(outPath).size, 'exitCode', child.exitCode);
}
// timeout safeguard
setTimeout(() => {
  if (!finished) {
    child.kill();
    finish();
  }
}, 300_000);

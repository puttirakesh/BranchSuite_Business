const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const adbName = process.platform === 'win32' ? 'adb.exe' : 'adb';
const defaultSdk = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'Android', 'Sdk')
  : process.platform === 'darwin' ? path.join(os.homedir(), 'Library', 'Android', 'sdk') : path.join(os.homedir(), 'Android', 'Sdk');
const sdkRoot = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, defaultSdk, path.join(projectRoot, '.android-sdk')]
  .find(candidate => candidate && fs.existsSync(path.join(candidate, 'platform-tools', adbName)));
const environment = { ...process.env };
if (sdkRoot) {
  environment.ANDROID_HOME = sdkRoot;
  environment.ANDROID_SDK_ROOT = sdkRoot;
  const pathKey = Object.keys(environment).find(key => key.toLowerCase() === 'path') || 'PATH';
  environment[pathKey] = path.join(sdkRoot, 'platform-tools') + path.delimiter + (environment[pathKey] || '');
  console.log(`Android Platform-Tools: ${path.join(sdkRoot, 'platform-tools')}`);
}
if (process.argv.includes('--check-android')) {
  if (!sdkRoot) { console.error('Android Platform-Tools are missing. Run npm run setup:android.'); process.exit(1); }
  const check = spawn(path.join(sdkRoot, 'platform-tools', adbName), ['version'], { stdio: 'inherit', env: environment });
  check.on('error', error => { console.error(error.message); process.exitCode = 1; });
  check.on('exit', code => { process.exitCode = code ?? 1; });
} else {
  const expoCli = path.join(path.dirname(require.resolve('expo/package.json')), 'bin', 'cli');
  const child = spawn(process.execPath, [expoCli, 'start', ...process.argv.slice(2)], { cwd: projectRoot, stdio: 'inherit', env: environment });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 1; });
}

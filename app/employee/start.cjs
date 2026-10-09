// Run with: node app/employee/start.cjs
// Start the frontend's Expo app, which opens the employee dashboard.
const { spawn } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');

function showConnection(address) {
  const url = `exp://${address}:8083`;
  console.log(`\nScan this QR code in Expo Go to open the employee dashboard:\n${url}`);
  try {
    // Reuse the QR printer included with this project's installed Expo CLI.
    const expoCli = require.resolve('expo/bin/cli');
    const cliPackage = require.resolve('@expo/cli/package.json', { paths: [path.dirname(expoCli)] });
    const { printQRCode } = require(path.join(path.dirname(cliPackage), 'build/src/utils/qr.js'));
    printQRCode(url).print();
  } catch {
    console.log('Enter the address above in Expo Go.');
  }
}

async function start() {
  console.log('Starting the employee dashboard using the frontend Expo app.');
  try {
    const response = await fetch('http://localhost:8083', {
      headers: { accept: 'application/expo+json', 'expo-platform': 'android' },
      signal: AbortSignal.timeout(2000),
    });
    const manifest = await response.json();
    if (manifest.extra?.expoClient?.slug === 'branchsuite-business') {
      console.log('The employee dashboard is already running.');
      console.log('Web: http://localhost:8083');
      const addresses = Object.values(os.networkInterfaces()).flat()
        .filter(address => address && address.family === 'IPv4' && !address.internal);
      for (const address of addresses) showConnection(address.address);
      console.log('Open the Expo Go address on a phone connected to the same Wi-Fi.');
      return;
    }
  } catch {
    // No employee server is available; start it below.
  }
  const expoCli = require.resolve('expo/bin/cli');
  const child = spawn(process.execPath, [expoCli, 'start', '--go', '--host', 'lan', '--port', '8083', '--clear'], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: 'inherit',
  });
  child.on('error', error => { console.error(error.message); process.exitCode = 1; });
  child.on('exit', code => { process.exitCode = code ?? 0; });
}

start().catch(error => { console.error(error.message); process.exitCode = 1; });

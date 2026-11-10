'use strict';
// Single APK-testing entry point (`npm run dev:apk`). PREFLIGHT ONLY:
// no database connection, no secret resolution, no backend spawn, no migration.
// It reports every blocker and always exits non-zero while startup is unauthorized.
const os = require('node:os');
const net = require('node:net');
const policy = require('./policy.cjs');
const plan = require('./development-plan.json');

function probePort(port, host) {
  // Binds and immediately releases; never connects to or stops another process.
  return new Promise(resolve => {
    const s = net.createServer();
    s.once('error', e => resolve(e.code === 'EADDRINUSE' ? 'IN_USE' : 'UNKNOWN:' + e.code));
    s.listen({port, host, exclusive: true}, () => s.close(() => resolve('FREE')));
  });
}

async function main() {
  if (process.argv.length !== 2) policy.refuseBackendStart();
  const blockers = [];
  try { policy.assertCleanInheritedEnvironment(process.env); }
  catch (e) { blockers.push(e.code + (e.keys ? ' (' + e.keys.join(', ') + ')' : '')); }

  const addresses = Object.values(os.networkInterfaces()).flat()
    .filter(a => a && a.family === 'IPv4' && !a.internal).map(a => a.address);
  let frontend = null;
  try { frontend = policy.frontendEnvironment(addresses); }
  catch (e) { blockers.push(e.code + ' (current IPv4: ' + (addresses.join(', ') || 'none') + ')'); }

  const port = Number(plan.backend.PORT);
  const portStatus = {loopback: await probePort(port, '127.0.0.1')};
  if (portStatus.loopback !== 'FREE') blockers.push('PORT_' + port + '_' + portStatus.loopback);

  const gates = policy.evaluateRuntimeGates(plan.runtimeGates);
  blockers.push(...gates.blockers);
  if (!plan.backendExecutionEnabled) blockers.push('BACKEND_EXECUTION_DISABLED_IN_PLAN');

  console.log(JSON.stringify({
    mode: plan.mode, backendExecutionEnabled: false, target: plan.target,
    backend: {NODE_ENV: 'development', PORT: plan.backend.PORT, apiPrefix: plan.backend.apiPrefix,
      bindAddress: plan.backend.defaultBindAddress,
      health: `http://127.0.0.1:${plan.backend.PORT}${plan.backend.apiPrefix}/health`},
    port: portStatus, ipv4: addresses, processScopedFrontend: frontend,
    gatesObservedAt: plan.runtimeGates && plan.runtimeGates.observedAt,
    status: 'BLOCKED', blockers,
  }, null, 2));
  // Even with zero blockers this module cannot start the backend (by design).
  policy.refuseBackendStart();
}

main().catch(e => { console.error(e.code || 'PREPARATION_REFUSED'); process.exitCode = 2; });

/* Expo host integration. The APK remains the source of UI and business rules. */
(function () {
  'use strict';
  const channel = 'branchsuite-host-v1';
  const send = payload => {
    const message = JSON.stringify({ channel, ...payload });
    if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(message);
    else if (window.parent !== window) window.parent.postMessage(message, window.location.origin === 'null' ? '*' : window.location.origin);
  };
  const seed = window.__BRANCHSUITE_STORAGE__ || {};
  let realStorage;
  try { realStorage = window.localStorage; } catch (_) { /* Use host storage. */ }
  const memory = { ...seed };
  const keys = [BranchSuiteConfig.dataKey, BranchSuiteConfig.draftKey];
  for (const key of keys) {
    try { if (!(key in memory) && realStorage?.getItem(key)) memory[key] = realStorage.getItem(key); } catch (_) {}
  }
  const storage = {
    getItem: key => memory[key] ?? null,
    setItem(key, value) {
      memory[key] = String(value);
      try { realStorage?.setItem(key, String(value)); } catch (_) {}
      send({ type: 'storage', storage: Object.fromEntries(keys.filter(k => k in memory).map(k => [k, memory[k]])) });
    },
    removeItem(key) { delete memory[key]; try { realStorage?.removeItem(key); } catch (_) {} },
    clear() { for (const key of keys) this.removeItem(key); },
    key: index => Object.keys(memory)[index] || null,
    get length() { return Object.keys(memory).length; }
  };
  Object.defineProperty(window, 'localStorage', { value: storage, configurable: true });
  window.BranchSuiteHost = {
    publish(route, db) {
      const account = db.accounts.find(a => a.id === db.session?.accountId);
      send({ type: 'route', route, role: account?.role || null, account: account ? { id: account.id, name: account.name, email: account.email, role: account.role, kind: account.kind, active: account.active } : null });
    }
  };
  if (window.ReactNativeWebView) {
    window.Android = { exportFile: (name, base64, mime) => send({ type: 'export', name, base64, mime }) };
  }
  function recovery(route) {
    document.querySelector('#app').innerHTML = '<main class="public-main"><section class="card form-narrow"><div class="eyebrow">BRANCHSUITE ADMIN</div><h1>' + (route === 'reset-password' ? 'Reset password' : 'Account recovery') + '</h1><p class="subtitle">This APK uses offline sample accounts. Password reset emails and reset tokens require a connected authentication service.</p><p class="note">Use platform@demo.example or support@demo.example with the sample password Demo123.</p><button class="btn full" id="recovery-back">Back to sign in</button></section></main>';
    document.querySelector('#recovery-back').onclick = () => window.Prototype.go('login');
    send({ type: 'route', route, role: null });
  }
  function receive(event) {
    if (event.source && event.source !== window.parent && event.source !== window) return;
    let message;
    try { message = typeof event.data === 'string' ? JSON.parse(event.data) : event.data; } catch (_) { return; }
    if (message?.channel !== channel || !window.Prototype) return;
    if (message.type === 'back') { send({ type: 'back-result', handled: window.Prototype.back() }); return; }
    if (message.type === 'admin-command') {
      window.Prototype.adminCommand(message.name,message.id,message.input).then(
        () => send({type:'command-result',requestId:message.requestId}),
        error => send({type:'command-result',requestId:message.requestId,error:error.message})
      );
      return;
    }
    if (message.type !== 'navigate' || typeof message.route !== 'string') return;
    if (['forgot-password', 'reset-password'].includes(message.route)) { recovery(message.route); return; }
    const target = message.route === 'login' && window.Prototype.getState().session ? 'platform-home' : message.route;
    window.Prototype.go(target, true);
    // Editors belong to the current list in the original APK.
    if (message.action && window.Prototype.getState().session) {
      const button = document.querySelector('[data-act="' + message.action + '"]' + (message.id ? '[data-id="' + CSS.escape(message.id) + '"]' : ''));
      if (button) button.click();
      else window.Prototype.openAdminEditor(message.action,message.id);
    }
  }
  window.addEventListener('message', receive);
  document.addEventListener('message', receive);
  window.addEventListener('keydown', event => { if (event.key === 'Escape') window.Prototype?.back(); });
  window.addEventListener('load', () => send({ type: 'ready' }));
})();

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { router, usePathname, type Href } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WebView } from 'react-native-webview';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { documentStart, documentScripts } from '../../../assets/branchsuite-document';
import { AuthContext } from '../auth/AuthContext';
import type { Account } from '../auth/auth.types';
import { DATABASE_KEY, STORAGE_KEY } from '../config/constants';
import type { Database } from '../../shared/types/common.types';

type Request = { route: string; action?: string; id?: string };
type HostMessage = { channel: string; type: string; route?: string; role?: string; account?: Account | null; storage?: Record<string, string>; name?: string; base64?: string; mime?: string; handled?: boolean; requestId?: string; error?: string };
export type AdminCommand = 'createPlan' | 'editPlan' | 'editSubscription' | 'editCoupon' | 'editCampaign' | 'editLead' | 'replyTicket' | 'payInvoice' | 'saveSettings' | 'exportInvoice' | 'signOut';
const Workspace = createContext<{ db: Database | null; command: (name: AdminCommand, id?: string, input?: object) => Promise<void> }>({ db: null, command: async () => { throw Error('Workspace unavailable'); } });
export const useWorkspace = () => useContext(Workspace);
const channel = 'branchsuite-host-v1';
const storageKey = STORAGE_KEY;
const Navigation = createContext<(request: Request) => void>(() => {});
const routes: Record<string, string> = {
  'platform-home': 'dashboard', 'platform-customers': 'customers', 'platform-customer': 'customers',
  'platform-plans': 'plans', 'platform-billing': 'billing', 'platform-invoice': 'billing',
  'platform-support': 'support', 'platform-ticket': 'support', 'platform-marketing': 'marketing',
  'platform-lead': 'marketing', 'platform-offers': 'offers', 'platform-settings': 'settings', 'platform-audit': 'audit',
};

// Route modules load lazily. Select the initial workspace before the frame is
// ready so an existing session cannot redirect an editor deep link to home.
function initialRequest(pathname: string): Request {
  const [section, record] = pathname.split('/').filter(part => part && !part.startsWith('('));
  if (['login', 'forgot-password', 'reset-password'].includes(section)) return { route: section };
  const route = Object.keys(routes).find(key => routes[key] === section);
  if (!route) return { route: 'login' };
  if (!record) return { route };
  if (section === 'plans' || section === 'offers') {
    const create = record === 'create';
    return { route, action: section === 'plans' ? (create ? 'saas-plan-new' : 'saas-edit-plan') : (create ? 'saas-offer-new' : 'saas-offer-edit'), ...(create ? {} : { id: record }) };
  }
  const detail = { customers: 'platform-customer', billing: 'platform-invoice', support: 'platform-ticket', marketing: 'platform-lead' }[section];
  return { route: detail ? detail + '/' + record : route };
}

/** Persistent host: changing Expo routes never unmounts the APK workspace. */
export function BranchSuiteProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [html, setHtml] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [db, setDb] = useState<Database | null>(null);
  const [auth, setAuth] = useState<{ account: Account | null; ready: boolean }>({ account: null, ready: false });
  const iframe = useRef<HTMLIFrameElement>(null);
  const webview = useRef<WebView<object>>(null);
  const ready = useRef(false);
  const desired = useRef<Request>(initialRequest(pathname));
  const pendingWrite = useRef(Promise.resolve());
  const lastStorage = useRef('');
  const saveFailed = useRef(false);
  const requests = useRef(new Map<string, { resolve: () => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>());
  const requestSequence = useRef(0);

  const hydrate = useCallback(async () => {
    try {
      setError('');
      ready.current = false;
      const raw = await AsyncStorage.getItem(storageKey);
      const storage: Record<string, string> = raw ? JSON.parse(raw) : {};
      if (storage[DATABASE_KEY]) setDb(JSON.parse(storage[DATABASE_KEY]));
      const seed = JSON.stringify(storage).replace(/</g, '\\u003c');
      setHtml(documentStart + '<script>window.__BRANCHSUITE_STORAGE__=' + seed + ';</script>' + documentScripts);
    } catch {
      setError('Unable to open saved BranchSuite data. Check device storage and retry.');
    }
  }, []);
  const send = useCallback((message: object) => {
    const text = JSON.stringify({ channel, ...message });
    if (Platform.OS === 'web') iframe.current?.contentWindow?.postMessage(text, window.location.origin);
    else webview.current?.postMessage(text);
  }, []);
  const command = useCallback((name: AdminCommand, id?: string, input?: object): Promise<void> => {
    if (!ready.current) return Promise.reject(Error('The workspace is still opening. Please retry.'));
    return new Promise((resolve, reject) => {
      const requestId = String(++requestSequence.current);
      const timer = setTimeout(() => { requests.current.delete(requestId); reject(Error('The action timed out. Check the saved record before retrying.')); }, 15000);
      requests.current.set(requestId, { resolve, reject, timer });
      send({ type: 'admin-command', requestId, name, id, input });
    });
  }, [send]);
  useEffect(() => { void hydrate(); }, [hydrate]);

  const navigate = useCallback((request: Request) => {
    if (JSON.stringify(desired.current) === JSON.stringify(request)) return;
    desired.current = request;
    if (ready.current) send({ type: 'navigate', ...request });
  }, [send]);

  const receive = useCallback(async (raw: string) => {
    let message: HostMessage;
    try { message = JSON.parse(raw); } catch { return; }
    if (message.channel !== channel) return;
    if (message.type === 'command-result' && message.requestId) {
      const request = requests.current.get(message.requestId);
      if (!request) return;
      requests.current.delete(message.requestId);
      clearTimeout(request.timer);
      if (message.error) request.reject(Error(message.error));
      else {
        try { await pendingWrite.current; if (saveFailed.current) throw Error('Storage unavailable'); request.resolve(); }
        catch { request.reject(Error('The change could not be saved to this device.')); }
      }
      return;
    }
    if (message.type === 'ready') {
      ready.current = true;
      send({ type: 'navigate', ...desired.current });
    } else if (message.type === 'storage' && message.storage) {
      if (message.storage[DATABASE_KEY]) {
        try { setDb(JSON.parse(message.storage[DATABASE_KEY])); } catch { setNotice('Saved workspace data could not be read.'); }
      }
      const value = JSON.stringify(message.storage);
      if (lastStorage.current === value) return;
      lastStorage.current = value;
      // Serialize saves so rapid edits cannot overwrite newer data with older data.
      pendingWrite.current = pendingWrite.current.then(async () => { await AsyncStorage.setItem(storageKey, value); saveFailed.current = false; }).catch(() => {
        saveFailed.current = true;
        lastStorage.current = '';
        setNotice('Changes could not be saved to device storage. Keep this window open and check available storage.');
      });
    } else if (message.type === 'route' && message.route) {
      setAuth({ account: message.account || null, ready: true });
      // Restore authentication even if the initial APK render precedes its ready
      // event. A rejected record route may never publish another render.
      if (!ready.current) return;
      // Keep an editor URL while its modal is open on the corresponding APK list.
      if (desired.current.action && desired.current.route === message.route) return;
      const changed = desired.current.route !== message.route;
      desired.current = { route: message.route };
      if (!changed) return;
      if (['login', 'forgot-password', 'reset-password'].includes(message.route)) {
        router.replace(('/(auth)/' + message.route) as Href);
      } else {
        const [name, id] = message.route.split('/');
        const section = routes[name];
        if (!section) return;
        const group = message.role === 'Platform Support' ? '(support)' : '(admin)';
        router.replace(('/' + group + '/' + section + (id ? '/' + encodeURIComponent(id) : '')) as Href);
      }
    } else if (message.type === 'back-result' && message.handled === false && Platform.OS === 'android') {
      BackHandler.exitApp();
    } else if (message.type === 'export' && message.base64 && message.name) {
      try {
        if (!FileSystem.cacheDirectory || !(await Sharing.isAvailableAsync())) throw Error('Sharing unavailable');
        const name = message.name.replace(/[^a-zA-Z0-9._-]/g, '_');
        const uri = FileSystem.cacheDirectory + name;
        await FileSystem.writeAsStringAsync(uri, message.base64, { encoding: FileSystem.EncodingType.Base64 });
        await Sharing.shareAsync(uri, { mimeType: message.mime, dialogTitle: 'Export ' + name });
      } catch { setNotice('The file could not be exported. Please retry on a device with file sharing available.'); }
    }
  }, [send]);

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const listener = (event: MessageEvent) => {
      if (event.source !== iframe.current?.contentWindow || event.origin !== window.location.origin || typeof event.data !== 'string') return;
      void receive(event.data);
    };
    window.addEventListener('message', listener);
    return () => window.removeEventListener('message', listener);
  }, [receive]);
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!ready.current) return false;
      send({ type: 'back' });
      return true;
    });
    return () => subscription.remove();
  }, [send]);

  return <AuthContext.Provider value={auth}><Navigation.Provider value={navigate}><Workspace.Provider value={{ db, command }}>
    {children}
    <View style={styles.container}>
      {error ? <View style={styles.loading}><Text style={styles.error}>{error}</Text><Pressable accessibilityRole="button" onPress={() => void hydrate()} style={styles.button}><Text style={styles.buttonText}>Retry</Text></Pressable></View> : !html ? <View style={styles.loading}><ActivityIndicator color="#6947B8" size="large" /><Text style={styles.caption}>Opening BranchSuite…</Text></View> : Platform.OS === 'web' ? React.createElement('iframe', {
        ref: iframe, title: 'BranchSuite Admin workspace', srcDoc: html,
        style: { border: 0, width: '100%', height: '100%', flex: 1, background: '#F8F6FF' },
        // Only the bundled, trusted APK scripts run here; its CSP blocks network access.
        sandbox: 'allow-scripts allow-same-origin allow-downloads allow-modals allow-forms',
      }) : <WebView<object> ref={webview} source={{ html, baseUrl: 'https://branchsuite.local/' }}
        originWhitelist={['https://branchsuite.local']} javaScriptEnabled domStorageEnabled
        onMessage={event => void receive(event.nativeEvent.data)}
        onShouldStartLoadWithRequest={request => ['about:blank', 'about:srcdoc', 'https://branchsuite.local/'].includes(request.url)}
        onError={() => setError('Unable to open the BranchSuite workspace. Please retry.')}
        style={styles.container} />}
      {!!notice && <Pressable accessibilityRole="button" accessibilityLabel="Dismiss notification" onPress={() => setNotice('')} style={styles.notice}><Text>{notice}</Text></Pressable>}
    </View>
  </Workspace.Provider></Navigation.Provider></AuthContext.Provider>;
}

/** Route files retain the ZIP structure and select a real APK screen or editor. */
export function BranchSuiteScreen({ route, action, id }: Request) {
  const navigate = useContext(Navigation);
  useEffect(() => { navigate({ route, action, id }); }, [navigate, route, action, id]);
  return null;
}
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F8F6FF' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 },
  caption: { color: '#52637A', fontSize: 16 }, error: { color: '#7D2735', textAlign: 'center', maxWidth: 440 },
  button: { backgroundColor: '#6947B8', padding: 14, borderRadius: 12 }, buttonText: { color: 'white', fontWeight: '700' },
  notice: { position: 'absolute', bottom: 90, left: 20, right: 20, padding: 16, backgroundColor: '#FFF1D6', borderRadius: 12 },
});

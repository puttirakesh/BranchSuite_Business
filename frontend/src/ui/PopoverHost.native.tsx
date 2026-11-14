import React, { createContext, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';

type Entry = { id: string; content: React.ReactNode; onDismiss: () => void };
type Host = { show: (entry: Entry) => void; remove: (id: string) => void };
const Context = createContext<Host | null>(null);

/** A portal in the SAME native window as the field, including inside form modals.
 * Android dialogs and app windows can use different status-bar coordinate origins.
 * Keeping both measurements here avoids guessing a status-bar offset.
 */
export function PopoverHost({ children, backHandlerRef }: { children: React.ReactNode; backHandlerRef?: React.RefObject<(() => boolean) | null> }) {
  const [entry, setEntry] = useState<Entry | null>(null);
  const current = useRef<Entry | null>(null);
  const host = useMemo<Host>(() => ({
    show(next) {
      if (current.current && current.current.id !== next.id) current.current.onDismiss();
      current.current = next;
      setEntry(next);
    },
    remove(id) {
      if (current.current?.id !== id) return;
      current.current = null;
      setEntry(null);
    },
  }), []);
  useEffect(() => {
    if (!backHandlerRef) return;
    backHandlerRef.current = () => {
      if (!current.current) return false;
      current.current.onDismiss();
      return true;
    };
    return () => { backHandlerRef.current = null; };
  }, [backHandlerRef]);
  useEffect(() => {
    if (!entry) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      current.current?.onDismiss();
      return true;
    });
    return () => subscription.remove();
  }, [!!entry]);
  return <Context.Provider value={host}><View style={styles.root} collapsable={false}>
    <View style={styles.root} importantForAccessibility={entry ? 'no-hide-descendants' : 'auto'}>{children}</View>
    {entry && <View style={styles.layer} accessibilityViewIsModal>{entry.content}</View>}
  </View></Context.Provider>;
}

export function PopoverPortal({ children, onDismiss }: { children: React.ReactNode; onDismiss: () => void }) {
  const host = useContext(Context);
  const id = useId();
  if (!host) throw new Error('Native dropdowns require a PopoverHost in their window.');
  useLayoutEffect(() => { host.show({ id, content: children, onDismiss }); }, [host, id, children, onDismiss]);
  useLayoutEffect(() => () => host.remove(id), [host, id]);
  return null;
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0 },
  layer: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, zIndex: 1000, elevation: 1000 },
});

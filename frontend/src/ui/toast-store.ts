import { clearSubmittedInputs } from './submitted-inputs';

export type ToastKind = 'success' | 'error' | 'info';
export type ToastMessage = { id: number; message: string; kind: ToastKind };

// Independent of React so feedback can survive navigation between screens.
export function createToastStore() {
  let nextId = 0;
  let snapshot: { toast: ToastMessage | null; host: string } = { toast: null, host: 'root' };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const listeners = new Set<() => void>();
  const hosts: string[] = [];
  const publish = () => listeners.forEach(listener => listener());
  const dismiss = (id?: number) => {
    if (id !== undefined && snapshot.toast?.id !== id) return;
    clearTimeout(timer);
    snapshot = { ...snapshot, toast: null };
    publish();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    show(message: string, kind: ToastKind = 'info') {
      const clean = message.trim();
      if (!clean) return;
      if (kind === 'success') clearSubmittedInputs();
      clearTimeout(timer);
      // Repeated feedback refreshes its lifetime without stacking banners.
      const id = snapshot.toast?.message === clean && snapshot.toast.kind === kind
        ? snapshot.toast.id : ++nextId;
      snapshot = { ...snapshot, toast: { id, message: clean, kind } };
      publish();
      timer = setTimeout(() => dismiss(id), 2000);
    },
    dismiss,
    registerHost(id: string) {
      hosts.push(id);
      snapshot = { ...snapshot, host: id };
      publish();
      return () => {
        const index = hosts.indexOf(id);
        if (index >= 0) hosts.splice(index, 1);
        snapshot = { ...snapshot, host: hosts[hosts.length - 1] ?? 'root' };
        publish();
      };
    },
  };
}

export const toastStore = createToastStore();
export const toast = {
  success: (message: string) => toastStore.show(message, 'success'),
  error: (message: string) => toastStore.show(message, 'error'),
  info: (message: string) => toastStore.show(message, 'info'),
  dismiss: () => toastStore.dismiss(),
};

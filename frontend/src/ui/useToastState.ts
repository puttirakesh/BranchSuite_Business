import { useCallback, useEffect, useRef, useState, type SetStateAction } from 'react';
import { toastStore, type ToastKind } from './toast-store';

// Keep existing inline feedback and also announce the outcome above the page.
// Field-specific validation continues to use ordinary state.
type FeedbackSetter = (next: SetStateAction<string>, kind?: ToastKind | null) => void;

export function useToastState(initial: string, kind: ToastKind): [string, FeedbackSetter] {
  const [value, setValue] = useState(initial);
  const current = useRef(initial);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    if (initial) toastStore.show(initial, kind);
    return () => { mounted.current = false; };
    // Initial route feedback is announced once; later messages use the setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const update = useCallback<FeedbackSetter>((next, feedbackKind = kind) => {
    if (!mounted.current) return;
    const resolved = typeof next === 'function' ? next(current.current) : next;
    current.current = resolved;
    setValue(resolved);
    if (resolved.trim() && feedbackKind !== null) toastStore.show(resolved, feedbackKind);
  }, [kind]);
  return [value, update];
}

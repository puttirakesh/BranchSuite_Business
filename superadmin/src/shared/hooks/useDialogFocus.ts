import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

/** Native Modal owns native focus; web dialogs trap Tab and restore their opener. */
export function useDialogFocus(open: boolean, onClose: () => void, testId: string) {
  const close = useRef(onClose);
  close.current = onClose;
  useEffect(() => {
    if (!open || Platform.OS !== 'web') return;
    const opener = document.activeElement as HTMLElement | null;
    const dialog = () => document.querySelector<HTMLElement>(`[data-testid="${testId}"]`);
    const buttons = () => Array.from(dialog()?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') ?? []).filter(el => el.getAttribute('aria-disabled') !== 'true');
    const timer = setTimeout(() => buttons()[0]?.focus(), 100);
    const keydown = (event: KeyboardEvent) => {
      const node = dialog();
      if (!node || !node.contains(document.activeElement)) return;
      if (event.key === 'Escape') { event.preventDefault(); event.stopImmediatePropagation(); close.current(); }
      const choices = buttons();
      if (event.key === 'Tab') {
        if (event.shiftKey && document.activeElement === choices[0]) { event.preventDefault(); choices.at(-1)?.focus(); }
        else if (!event.shiftKey && document.activeElement === choices.at(-1)) { event.preventDefault(); choices[0]?.focus(); }
      }
      const active = document.activeElement as HTMLElement;
      if (active?.dataset.testid?.startsWith('calendar-day-')) {
        const offset = ({ ArrowRight: 1, ArrowLeft: -1, ArrowDown: 7, ArrowUp: -7 } as Record<string, number>)[event.key];
        if (offset) {
          event.preventDefault();
          const cells = Array.from(node.querySelectorAll<HTMLElement>('[data-testid^="calendar-day-"]'));
          const next = cells[cells.indexOf(active) + offset];
          if (next?.getAttribute('aria-disabled') !== 'true') next?.focus();
        }
      }
    };
    document.addEventListener('keydown', keydown, true);
    return () => { clearTimeout(timer); document.removeEventListener('keydown', keydown, true); opener?.focus(); };
  }, [open, testId]);
}

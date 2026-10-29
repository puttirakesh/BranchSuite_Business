import React, { useEffect } from 'react';

const isTextField = (el: Element | null): el is HTMLElement =>
  !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || (el as HTMLElement).isContentEditable);

// Mobile browsers overlay the on-screen keyboard on a fixed-height page. Track the visible
// viewport so the layout shrinks above the keyboard, then keep the focused field in view.
export function AppKeyboardProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    if (typeof window === 'undefined' || typeof document === 'undefined') return;
    const viewport = window.visualViewport;
    const root = document.getElementById('root');
    let timer: ReturnType<typeof setTimeout> | undefined;

    const reveal = () => {
      const active = document.activeElement;
      if (isTextField(active)) active.scrollIntoView({ block: 'center', behavior: 'smooth' });
    };
    const resize = () => {
      if (!viewport || !root) return;
      const keyboardOpen = window.innerHeight - viewport.height > 120;
      root.style.height = keyboardOpen ? `${viewport.height}px` : '';
      if (keyboardOpen) window.scrollTo(0, 0);
      clearTimeout(timer);
      timer = setTimeout(reveal, 100);
    };
    const onFocus = () => {
      clearTimeout(timer);
      timer = setTimeout(reveal, 350);
    };

    viewport?.addEventListener('resize', resize);
    document.addEventListener('focusin', onFocus);
    return () => {
      viewport?.removeEventListener('resize', resize);
      document.removeEventListener('focusin', onFocus);
      clearTimeout(timer);
      if (root) root.style.height = '';
    };
  }, []);

  return <>{children}</>;
}

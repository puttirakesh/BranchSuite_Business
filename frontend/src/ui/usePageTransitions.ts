import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

/** Keep page changes subtle, with no motion when the system requests it. */
export function usePageTransitions() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let active = true;
    const update = (enabled: boolean) => { if (active) setReduceMotion(enabled); };
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', update);
    AccessibilityInfo.isReduceMotionEnabled().then(update).catch(() => {});
    return () => { active = false; subscription.remove(); };
  }, []);
  return {
    headerShown: false,
    animation: reduceMotion ? 'none' as const : 'fade' as const,
    animationDuration: 180,
  };
}

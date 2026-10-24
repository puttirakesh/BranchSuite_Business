import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

/** Follow the device's local time, including when the app returns from the background. */
export function useTimeGreeting() {
  const [greeting, setGreeting] = useState(timeGreeting);
  useEffect(() => {
    const update = () => setGreeting(timeGreeting());
    const timer = setInterval(update, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    update();
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return greeting;
}

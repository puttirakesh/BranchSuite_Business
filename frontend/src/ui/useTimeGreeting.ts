import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

function timeGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good Morning';
  if (hour < 17) return 'Good Afternoon';
  return 'Good Evening';
}

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
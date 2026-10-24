import React, { useCallback, useState } from 'react';
import { AppState, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useDesktopStyles } from './useDesktopStyles';

/** Shared live clock for both dashboards, using the device's local date and time. */
export function DashboardDateTimeCard() {
  const styles = useDesktopStyles(baseStyles);
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(useCallback(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      clearTimeout(timer);
      setNow(new Date());
      timer = setTimeout(update, 1000 - (Date.now() % 1000) + 20);
    };
    update();
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') update();
    });
    return () => {
      clearTimeout(timer);
      subscription.remove();
    };
  }, []));

  return <View testID="dashboard-date-time" style={styles.card}>
    <Text testID="dashboard-date" style={styles.date}>
      {now.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
    </Text>
    <Text testID="dashboard-time" style={styles.time}>
      {now.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true }).toUpperCase()}
    </Text>
  </View>;
}

const baseStyles = StyleSheet.create({
  card: { flexShrink: 0, alignItems: 'center', padding: 10, borderRadius: 12, backgroundColor: '#ffffff' },
  date: { fontSize: 12, fontWeight: '700', color: '#263246' },
  time: { fontSize: 12, color: '#8e97a8', marginTop: 3 },
});

import React from 'react';
import { AppIcon } from './AppIcon';

const names = {
  chart: 'bar-chart-2', people: 'users', wallet: 'credit-card', file: 'file-text',
  lock: 'shield', building: 'briefcase', clock: 'clock', settings: 'settings',
  support: 'headphones', home: 'home', more: 'more-horizontal', search: 'search', close: 'x',
} as const;
export type AdminMenuIconName = keyof typeof names;
export function AdminMenuIcon({ name, color = '#5c79bd' }: { name: AdminMenuIconName; color?: string }) {
  return <AppIcon name={names[name]} color={color} size={20} />;
}

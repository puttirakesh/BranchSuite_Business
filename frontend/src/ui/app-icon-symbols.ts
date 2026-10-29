import type Feather from '@expo/vector-icons/Feather';
import type React from 'react';

export type AppIconName = React.ComponentProps<typeof Feather>['name'];

// Keep legacy text symbols working while screens migrate to explicit icon names.
export const iconSymbols: Record<string, AppIconName> = {
  '⌄': 'chevron-down', '▾': 'chevron-down', '▼': 'chevron-down',
  '∨': 'chevron-down', '⌃': 'chevron-up', '›': 'chevron-right', '‹': 'chevron-left',
  '→': 'arrow-right', '←': 'arrow-left', '⌕': 'search', '♙': 'users', '👥': 'users',
  '◷': 'clock', '☑': 'check-square', '☐': 'square', '☷': 'list', '⌂': 'home',
  '↗': 'trending-up', '▤': 'file-text', '▥': 'bar-chart-2', '▦': 'grid',
  '₹': 'credit-card', '✓': 'check', '×': 'x', '+': 'plus', '−': 'minus',
  'ⓘ': 'info', '♧': 'calendar', '···': 'more-horizontal', '…': 'more-horizontal',
  '✉': 'mail', '🔐': 'lock', '⚙': 'settings', '☎': 'phone',
  calendar: 'calendar', document: 'file-text', help: 'headphones', building: 'briefcase',
  '◇': 'clipboard', '▣': 'credit-card', '◉': 'check-circle', '○': 'circle',
};

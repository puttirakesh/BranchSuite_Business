import React from 'react';
import Svg, { Path } from 'react-native-svg';
import { View } from 'react-native';

/** Feather-compatible outline paths; one SVG renderer keeps native and web independent of fonts. */
const paths = {
  calendar: 'M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2',
  home: 'M3 10 12 3l9 7M5 9v11h5v-6h4v6h5V9',
  leads: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M15 3a4 4 0 0 1 0 8M22 21v-2a4 4 0 0 0-3-3.87M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  team: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M19 8v6M16 11h6',
  approvals: 'M9 12l2 2 4-4M12 3l9 4v5c0 5-4 8-9 10-5-2-9-5-9-10V7z',
  attendance: 'M12 8v4l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  profile: 'M20 21v-2a7 7 0 0 0-14 0v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
  chevron: 'm9 5 7 7-7 7',
  down: 'm6 9 6 6 6-6',
  back: 'm15 18-6-6 6-6',
  plus: 'M12 5v14M5 12h14',
  search: 'M21 21l-5-5M17 10a7 7 0 1 1-14 0 7 7 0 0 1 14 0',
  filter: 'M4 6h16M7 12h10M10 18h4',
  building: 'M4 21V3h12v18M2 21h20M16 10h4v11M8 7h4M8 11h4M8 15h4',
  check: 'm5 12 4 4L19 6',
  close: 'm6 6 12 12M6 18 18 6',
  logout: 'M9 21H3V3h6M8 12h13M17 8l4 4-4 4',
  support: 'M3 14v-3a9 9 0 0 1 18 0v3M3 11h4v7H3zM17 11h4v7h-4zM21 18c0 3-4 3-7 3',
  quote: 'M5 3h10l4 4v14H5zM14 3v5h5M8 12h8M8 16h5',
  settings: 'M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8M9 3l1-2h4l1 2 2 1 2 0 2 3-1 2v4l1 2-2 3h-2l-2 1-1 2h-4l-1-2-2-1H5l-2-3 1-2V9L3 7l2-3h2z',
  mail: 'M3 5h18v14H3zM3 6l9 7 9-7',
  phone: 'M7 3l3 5-3 3c2 4 3 5 7 7l3-3 4 3c0 4-2 4-4 4C9 21 3 15 2 7c0-2 1-4 5-4',
  eye: 'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',
  download: 'M12 3v12M7 10l5 5 5-5M4 16v5h16v-5',
  info: 'M12 11v6M12 7h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0',
  lock: 'M5 10h14v11H5zM8 10V6a4 4 0 0 1 8 0v4',
  edit: 'm16 3 5 5-12 12-6 1 1-6zM14 5l5 5',
  refresh: 'M3 10a9 9 0 0 1 15-6l3 3M21 3v4h-4M21 14a9 9 0 0 1-15 6l-3-3M3 21v-4h4',
  wallet: 'M3 6h17v15H3zM3 6V3h14v3M15 11h6v5h-6z',
  doc: 'M5 3h10l4 4v14H5zM14 3v5h5M8 13h8M8 17h6',
  cloud: 'M6 18h12a4 4 0 0 0 0-8 6 6 0 0 0-12-1 4.5 4.5 0 0 0 0 9',
  star: 'm12 3 3 6 7 1-5 5 1 7-6-3-6 3 1-7-5-5 7-1z',
  more: 'M5 12h.01M12 12h.01M19 12h.01',
} as const;

export type IconName = keyof typeof paths;

export function Icon({ name, size = 18, color = 'currentColor', strokeWidth = 2 }: { name: IconName; size?: number; color?: string; strokeWidth?: number }) {
  return (
    <View aria-hidden pointerEvents="none">
      <Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
        <Path d={paths[name]} stroke={color} strokeWidth={name === 'more' ? 3 : strokeWidth} strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
    </View>
  );
}

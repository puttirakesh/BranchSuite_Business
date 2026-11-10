import type { IconName } from '../shared/components/Icon';
/** Adapted from Business iconAccent.ts: pastels on navy, strong hues on white. */
export const moduleIconColors: Partial<Record<IconName, string>> = {
  home: '#7DD3FC', building: '#FDBA74', leads: '#93C5FD', team: '#93C5FD',
  attendance: '#67E8F9', calendar: '#D8B4FE', wallet: '#E9D5FF', quote: '#FCD34D',
  doc: '#FCD34D', support: '#67E8F9', approvals: '#C4B5FD', star: '#FDE68A', settings: '#CBD5E1',
};
export const moduleIconColor = (name: IconName) => moduleIconColors[name] ?? '#7DD3FC';

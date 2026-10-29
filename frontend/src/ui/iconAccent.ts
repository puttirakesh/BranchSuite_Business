import type { AppIconName } from './app-icon-symbols';

/** Sidebar module colours: pastel icons on the navy sidebar. */
export const moduleIconColors: Partial<Record<AppIconName, string>> = {
  home: '#7DD3FC', 'bar-chart-2': '#FDE68A', 'trending-up': '#6EE7B7',
  users: '#93C5FD', clock: '#67E8F9', calendar: '#D8B4FE',
  'check-circle': '#86EFAC', 'check-square': '#A7F3D0',
  'credit-card': '#E9D5FF', briefcase: '#FDBA74', grid: '#A5B4FC',
  'file-text': '#FCD34D', user: '#FDA4AF', shield: '#C4B5FD',
};
export const defaultModuleIconColor = '#7DD3FC';

/** Saturated twins of the sidebar pastels (same hues) for icons drawn on light backgrounds. */
const strongColors: Record<string, string> = {
  '#7DD3FC': '#0284C7', '#FDE68A': '#D97706', '#6EE7B7': '#059669', '#93C5FD': '#2563EB',
  '#67E8F9': '#0891B2', '#D8B4FE': '#9333EA', '#86EFAC': '#16A34A', '#A7F3D0': '#0D9488',
  '#E9D5FF': '#7C3AED', '#FDBA74': '#EA580C', '#A5B4FC': '#4F46E5', '#FCD34D': '#CA8A04',
  '#FDA4AF': '#E11D48', '#C4B5FD': '#7C3AED',
};

export function strongColor(pastel: string): string {
  return strongColors[pastel] ?? pastel;
}

/** Hues for icons the sidebar leaves on its default colour, so every icon is distinct on light pages. */
const extraStrong: Partial<Record<AppIconName, string>> = {
  'dollar-sign': '#16A34A', 'git-branch': '#7C3AED', activity: '#E11D48', settings: '#475569',
  package: '#EA580C', 'help-circle': '#0891B2', 'phone-call': '#16A34A', phone: '#16A34A',
  'user-check': '#0D9488', 'user-plus': '#2563EB', list: '#4F46E5', mail: '#2563EB',
  bell: '#D97706', 'map-pin': '#E11D48', target: '#DC2626', headphones: '#0891B2',
  'alert-circle': '#D97706', 'x-circle': '#DC2626', info: '#2563EB', file: '#CA8A04',
  clipboard: '#4F46E5', download: '#2563EB', edit: '#2563EB', eye: '#475569',
  server: '#475569', sliders: '#2563EB', tablet: '#475569', star: '#D97706', lock: '#7C3AED',
  navigation: '#2563EB', link: '#2563EB', radio: '#DC2626', 'log-in': '#16A34A', 'log-out': '#E11D48',
};

/** Strong accent for a module/status icon; undefined for purely functional icons (chevrons, close, plus…). */
export function strongIconColor(name: AppIconName): string | undefined {
  const pastel = moduleIconColors[name];
  return pastel ? strongColor(pastel) : extraStrong[name];
}

/** Ink values pages use for "plain" icons; only these are replaced by the accent. */
export const neutralIconInk = new Set([
  '#607591', '#405573', '#20334f', '#71829c', '#8192ad', '#62758b', '#6a7d90', '#586d8b',
  '#607089', '#000', '#000000', '#1b2d4a', '#17243b', '#5f6368', '#345cf2', '#2563eb', '#3157d5',
]);

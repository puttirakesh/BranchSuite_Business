import type { AppIconName } from './AppIcon';
import { adminDestinations } from './workspace-navigation';
import { defaultModuleIconColor, moduleIconColors, strongColor } from './iconAccent';

export { defaultModuleIconColor, moduleIconColors } from './iconAccent';

export function moduleIconColor(icon: AppIconName): string {
  return moduleIconColors[icon] ?? defaultModuleIconColor;
}

/** The sidebar colour of the destination a route belongs to (longest matching href wins). */
export function moduleColorForRoute(route: string | undefined): string {
  if (!route) return defaultModuleIconColor;
  const destination = adminDestinations
    .filter(item => route === item.href || route.startsWith(`${item.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0];
  return destination ? moduleIconColor(destination.icon) : defaultModuleIconColor;
}

export function strongModuleColorForRoute(route: string | undefined): string {
  return strongColor(moduleColorForRoute(route));
}

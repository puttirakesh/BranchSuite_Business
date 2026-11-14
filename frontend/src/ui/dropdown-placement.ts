import { dropdownTokens } from './dropdown-tokens';

type Bounds = { x: number; y: number; width: number; height: number };
export type DropdownPlacement = { left: number; width: number; maxHeight: number; top?: number; bottom?: number };

/** Match the field width and keep the menu below it; never cover the input or flip above it. */
export function dropdownPlacement(field: Bounds, viewport: { width: number; height: number }): DropdownPlacement {
  const margin = 8;
  const gap = dropdownTokens.menuGap;
  const width = Math.min(field.width, Math.max(0, viewport.width - margin * 2));
  const left = Math.max(margin, Math.min(field.x, viewport.width - width - margin));
  const fieldBottom = field.y + field.height;
  const below = Math.max(0, viewport.height - fieldBottom - gap - margin);
  // Size to actual content, up to the available space. Short lists must not
  // acquire a scrollbar just because an estimated row height was too small.
  const maxHeight = below;
  return { left, width, maxHeight, top: fieldBottom + gap };
}

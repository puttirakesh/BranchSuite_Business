import { useMemo } from 'react';
import { Platform, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { webWorkspaceStyles } from './webWorkspaceStyles';
import { adminGrid, adminPageSpacing } from './adminResponsive';
import { useAdminViewport } from './useAdminViewport';

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;
const fields = new Set([
  'input', 'searchInput', 'leadSearchInput', 'searchText', 'inputBox',
  'searchField', 'searchBox', 'textInput', 'fieldInput', 'dateInput',
  'amountInput', 'reasonInput', 'notesInput', 'textarea', 'selector', 'select',
]);
const controls = new Set([
  'primary', 'secondary', 'submit', 'saveButton', 'cancel', 'assign',
  'addButton', 'exportButton', 'retry', 'filter', 'stageFilter',
  'branchFilter', 'headerFilter', 'companyFilter', 'option', 'button',
]);

/** Phones and tablets: text under 12px is hard to read, so lift it (compact nav labels keep 10px). */
export function liftSmallText<T extends NamedStyles>(base: T): T {
  return Object.fromEntries(Object.entries(base).map(([key, value]) => {
    const style = value as TextStyle;
    if (typeof style.fontSize !== 'number' || style.fontSize >= 12 || /glyph|symbol|chevron|iconText/i.test(key)) return [key, value];
    const minimum = /^(navLabel|headerCaption|eyebrow)$/.test(key) ? 10 : 12;
    const fontSize = Math.max(minimum, style.fontSize);
    return [key, { ...style, fontSize, lineHeight: Math.max(fontSize + 5, typeof style.lineHeight === 'number' ? style.lineHeight : 0) }];
  })) as T;
}

/** Desktop density is independent of the mobile touch and font-size rules. */
export function desktopStyles<T extends NamedStyles>(base: T): T {
  return Object.fromEntries(Object.entries(base).map(([key, value]) => {
    const style = { ...value } as TextStyle;
    const icon = /glyph|symbol|chevron|iconText/i.test(key);
    if (typeof style.fontSize === 'number' && !icon) {
      if (/^(title|leaveTitle)$/.test(key)) style.fontSize = 28;
      else if (/^(label|fieldLabel|inputLabel|filterLabel)$/.test(key)) style.fontSize = 12;
      else if (/^(greeting|hello)$/.test(key)) style.fontSize = 28;
      else if (/sectionTitle/i.test(key)) style.fontSize = 18;
      else if (/modalTitle|dialogTitle|heading/i.test(key)) style.fontSize = Math.min(20, style.fontSize);
      else if (/value|amount|balanceNumber|count|number|percentage|price|^net$|^total$/i.test(key)) style.fontSize = Math.min(30, style.fontSize);
      else if (/eyebrow/i.test(key)) style.fontSize = 11;
      else if (/caption|hint|helper|muted|small|footer|navLabel/i.test(key)) style.fontSize = 12;
      else if (/cardTitle|rowTitle|taskTitle|workspaceTitle|eventTitle|^name$/i.test(key)) style.fontSize = Math.min(16, Math.max(14, style.fontSize));
      else if (style.fontSize >= 22) style.fontSize = Math.min(26, style.fontSize);
      else style.fontSize = Math.min(14, Math.max(13, style.fontSize));
      style.lineHeight = style.fontSize + (style.fontSize >= 24 ? 8 : 6);
    }
    const weight = Number(style.fontWeight);
    if (!icon && weight >= 700) style.fontWeight = '600';
    if (/label$/i.test(key) && weight >= 600) style.fontWeight = '500';

    if (fields.has(key)) {
      // Notes and descriptions retain their larger editing area.
      const multiline = Math.max(Number(style.minHeight) || 0, Number(style.height) || 0) >= 72;
      if (!multiline) {
        style.minHeight = 44;
        if (typeof style.height === 'number') style.height = 44;
      }
      style.paddingHorizontal = 12;
      style.paddingVertical = /^(inputBox|searchField|searchBox)$/.test(key) ? 0 : 8;
      style.borderRadius = 10;
      style.fontSize = 14;
      style.lineHeight = 20;
      style.fontWeight = '400';
      if (style.borderWidth) style.borderColor = '#dce3e7';
      if (style.backgroundColor) style.backgroundColor = '#fff';
    }
    if (key === 'inputText' || key === 'selectorText') {
      style.fontSize = 14;
      style.lineHeight = 20;
      style.fontWeight = '400';
    }
    if (controls.has(key)) {
      style.minHeight = 44;
      if (typeof style.height === 'number' && style.height <= 60) style.height = 44;
      if (typeof style.borderRadius === 'number') style.borderRadius = Math.min(10, style.borderRadius);
      if (typeof style.paddingVertical === 'number') style.paddingVertical = Math.min(8, style.paddingVertical);
    }
    return [key, style];
  })) as T;
}

export function useDesktopStyles<T extends NamedStyles>(base: T, enabled?: boolean): T {
  const { width, fontScale, desktop: viewportDesktop, layout } = useAdminViewport();
  const desktop = enabled ?? viewportDesktop;
  const padding = adminPageSpacing(width);
  const contentWidth = Math.max(0, width - padding * 2);
  return useMemo(() => {
    if (!desktop) { const lifted = liftSmallText(base); return Platform.OS === 'web' ? webWorkspaceStyles(lifted) : lifted; }
    const styled = webWorkspaceStyles(desktopStyles(base));
    const columnsFor = (key: string) => adminGrid(contentWidth, fontScale, key === 'workspace' || key === 'card' ? 'workspace' : 'overview', 12, layout).columns;
    return Object.fromEntries(Object.entries(styled).map(([key, value]) => {
      if (value.width !== '46%') return [key, value];
      const columns = columnsFor(key);
      return [key, {
        ...value,
        width: Math.max(0, (contentWidth - (columns - 1) * 12) / columns),
        flexGrow: 0,
        minWidth: 0,
      }];
    })) as T;
  }, [base, desktop, contentWidth, fontScale, layout]);
}

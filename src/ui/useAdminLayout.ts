import { useMemo } from 'react';
import { type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useAdminViewport } from './useAdminViewport';

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;
type LayoutKind = 'page' | 'form' | 'detail' | 'list';

/** Shared admin breakpoints, including larger native accessibility text sizes. */
export function useAdminLayout<T extends NamedStyles>(base: T, kind: LayoutKind = 'page') {
  const { width, height, fontScale, desktop } = useAdminViewport();
  return useMemo(() => {
    const maxWidth = kind === 'form' || kind === 'detail' ? 960 : 1280;
    const pageWidth = Math.min(width, maxWidth);
    const padding = pageWidth >= 1000 ? 32 : pageWidth >= 600 ? 24 : 16;
    const contentWidth = Math.max(0, pageWidth - padding * 2);
    const compact = contentWidth / fontScale < 340;
    const wide = contentWidth / fontScale >= 650;
    const gridColumns = contentWidth / fontScale >= 900 ? 4 : compact ? 1 : 2;
    const columns = kind === 'list' && wide ? 2 : 1;
    const result: NamedStyles = { ...base };
    if (desktop) {
      const palette: Record<string, string> = {
        '#345cf2': '#007f75', '#f6f8fd': '#f3f9f8', '#f6f7fb': '#f3f9f8',
        '#20334f': '#152b3c', '#263246': '#152b3c', '#e4eaf5': '#dce7e6',
        '#eaf0ff': '#e0f3ed', '#d5dfff': '#c9e6de',
        '#8e97a8': '#586d7c', '#8192ad': '#586d7c', '#8794aa': '#586d7c',
        '#7a8ba5': '#586d7c', '#71829c': '#586d7c', '#8b95a8': '#586d7c',
        '#9099ac': '#586d7c', '#737f91': '#586d7c', '#607591': '#586d7c',
      };
      for (const [key, value] of Object.entries(base)) {
        const themed = { ...value } as Record<string, unknown>;
        for (const [property, color] of Object.entries(themed)) {
          if (typeof color === 'string' && palette[color]) themed[property] = palette[color];
        }
        if ('fontSize' in value && typeof value.fontSize === 'number' && value.fontSize < 14) {
          themed.fontSize = key === 'eyebrow' ? 11 : Math.max(14, value.fontSize);
          themed.lineHeight = key === 'eyebrow' ? 16 : Math.max(20, 'lineHeight' in value ? value.lineHeight || 0 : 0);
        }
        result[key] = themed;
      }
    }
    const patch = (key: string, value: ViewStyle | TextStyle) => {
      if (base[key]) result[key] = { ...result[key], ...value };
    };

    patch('page', { maxWidth, minWidth: 0, minHeight: 0 });
    patch('flex', { minWidth: 0, minHeight: 0 });
    patch('header', { paddingHorizontal: padding, ...(desktop ? { backgroundColor: '#f3f9f8', borderBottomWidth: 0, paddingTop: 0, paddingBottom: 0 } : {}) });
    patch('content', { paddingHorizontal: padding });
    patch('list', { paddingHorizontal: padding });
    patch('navigation', { paddingHorizontal: padding, flexShrink: 0, ...(desktop ? { display: 'none' } : {}) });
    patch('navItem', { minWidth: 0, minHeight: 48 });
    patch('navLabel', { textAlign: 'center' });
    patch('overlay', { padding: width < 380 || height < 500 ? 12 : 24 });
    patch('modal', { maxHeight: '90%', minHeight: 0, padding: width < 380 ? 16 : 22 });
    if (desktop) {
      patch('title', { fontSize: 30, lineHeight: 38 });
      patch('greeting', { fontSize: 32, lineHeight: 40 });
      patch('sectionTitle', { fontSize: 20, lineHeight: 28 });
      patch('headerFilters', { marginTop: 18 });
      patch('filters', { marginTop: 18 });
      patch('content', { paddingTop: 32 });
      patch('card', { borderColor: '#dce7e6', padding: 20 });
      patch('runCard', { backgroundColor: '#efe9f8', minHeight: 260 });
      for (const key of ['input', 'searchInput', 'inputText']) patch(key, { fontSize: 15 });
      patch('input', { minHeight: 48 });
      patch('searchInput', { minHeight: 48 });
    }

    for (const key of ['headerFilters', 'filters']) {
      patch(key, { ...(compact ? { flexDirection: 'column' } : {}), ...(wide ? { maxWidth: 600 } : {}) });
    }
    for (const key of ['headerFilter', 'filter', 'companyFilter', 'branchFilter']) {
      // Some branch styles only supply a color override, rather than a whole filter.
      if (base[key] && 'flex' in base[key]) patch(key, { minWidth: 0, minHeight: 44 });
    }
    for (const key of ['heading', 'summaryGrid', 'cardMeta', 'pagination', 'times', 'actions', 'exportButtons', 'decisionButtons']) {
      patch(key, { flexWrap: 'wrap' });
    }
    if (compact) patch('summaryGrid', { flexDirection: 'column' });
    patch('summaryHeading', { flexWrap: 'wrap' });
    patch('summary', { flexWrap: 'wrap' });
    patch('summaryItem', { minWidth: 80 });
    patch('steps', { flexWrap: 'wrap', rowGap: 12 });
    patch('step', { minWidth: 80 });
    patch('detail', { width: compact ? '100%' : '50%' });
    patch('fullDetail', { width: '100%' });
    for (const key of ['name', 'rowTitle', 'filterText', 'company', 'companyName', 'statusText', 'workspaceTitle']) {
      patch(key, { flexShrink: 1 });
    }
    for (const [key, value] of Object.entries(base)) {
      if ('width' in value && value.width === '46%') {
        patch(key, { width: Math.max(0, (contentWidth - (gridColumns - 1) * 12) / gridColumns), flexGrow: 0, minWidth: 0 });
      }
    }

    const formCard: ViewStyle = wide
      ? { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, alignItems: 'flex-start' }
      : {};
    if (kind === 'form') {
      patch('field', { width: wide ? '47%' : '100%', flexGrow: wide ? 1 : 0, minWidth: 0 });
      patch('cardTitle', { width: '100%' });
    }
    const listItem: ViewStyle = columns > 1
      ? { flex: 1, maxWidth: (contentWidth - 12) / 2, minWidth: 0 }
      : { width: '100%', minWidth: 0 };

    return {
      styles: {
        ...result, formCard, fullField: { width: '100%' } as ViewStyle, listItem,
        headerIdentity: { display: desktop ? 'none' : 'flex' } as ViewStyle,
        splitLayout: { flexDirection: desktop && wide ? 'row' : 'column', gap: desktop && wide ? 24 : 0 } as ViewStyle,
        splitPanel: { flex: desktop && wide ? 1 : undefined, minWidth: 0 } as ViewStyle,
        panelMetric: { width: contentWidth / fontScale < 420 ? '100%' : '47%', flexGrow: 1 } as ViewStyle,
        fillPanel: { flex: desktop && wide ? 1 : undefined } as ViewStyle,
        responsiveRecordCard: { width: wide ? Math.max(0, (contentWidth - 12) / 2) : contentWidth, marginBottom: 0, minWidth: 0 } as ViewStyle,
        filterGrid: { flexDirection: desktop && wide ? 'row' : 'column', flexWrap: 'wrap', columnGap: 16 } as ViewStyle,
        filterField: { width: desktop && wide ? '28%' : '100%', flexGrow: desktop && wide ? 1 : 0, minWidth: 0 } as ViewStyle,
      } as T & {
        formCard: ViewStyle; fullField: ViewStyle; listItem: ViewStyle; headerIdentity: ViewStyle;
        splitLayout: ViewStyle; splitPanel: ViewStyle; panelMetric: ViewStyle; fillPanel: ViewStyle;
        responsiveRecordCard: ViewStyle;
        filterGrid: ViewStyle; filterField: ViewStyle;
      },
      columns,
      contentWidth,
      splitPanels: desktop && wide,
      fontScale,
      columnWrapperStyle: { gap: 12, alignItems: 'stretch' } as ViewStyle,
    };
  }, [base, kind, width, height, fontScale, desktop]);
}

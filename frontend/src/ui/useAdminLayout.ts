import { useMemo } from 'react';
import { type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';
import { useAdminViewport } from './useAdminViewport';
import { adminGrid, adminPageSpacing } from './adminResponsive';
import { desktopStyles } from './useDesktopStyles';
import { colors } from '../shared/theme/colors';

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;
type LayoutKind = 'page' | 'form' | 'detail' | 'list';

/** Shared admin breakpoints, including larger native accessibility text sizes. */
export function useAdminLayout<T extends NamedStyles>(base: T, kind: LayoutKind = 'page') {
  const { width, height, fontScale, desktop, mobile, tablet, webNavigation, keyboardVisible, insets } = useAdminViewport();
  return useMemo(() => {
    const maxWidth = kind === 'form' || kind === 'detail' ? 960 : 1280;
    const pageWidth = Math.min(width, maxWidth);
    const padding = adminPageSpacing(pageWidth);
    const contentWidth = Math.max(0, pageWidth - padding * 2);
    const compact = contentWidth / fontScale < 340;
    const wide = !mobile && contentWidth / fontScale >= 600;
    const screen = desktop ? 'desktop' : tablet ? 'tablet' : 'mobile';
    const gridColumns = adminGrid(contentWidth, fontScale, 'overview', 12, screen).columns;
    const workspaceColumns = adminGrid(contentWidth, fontScale, 'workspace', 12, screen).columns;
    const recordGrid = adminGrid(contentWidth, fontScale, 'records', 12, screen);
    const columns = kind === 'list' && wide ? 2 : 1;
    const result: NamedStyles = { ...base };
    for (const [key, value] of Object.entries(base)) {
      const responsive: Record<string, unknown> = { ...value };
      if (typeof responsive.width === 'number' && responsive.width > contentWidth) {
        responsive.width = contentWidth;
      }
      if (typeof responsive.minWidth === 'number' && responsive.minWidth > contentWidth) {
        responsive.minWidth = contentWidth;
      }
      result[key] = responsive as ViewStyle | TextStyle | ImageStyle;
    }
    if (!desktop) {
      for (const [key, value] of Object.entries(base)) {
        if ('fontSize' in value && typeof value.fontSize === 'number' && value.fontSize < 12) {
          const minimum = key === 'navLabel' || key === 'headerCaption' || key === 'eyebrow' ? 10 : 12;
          result[key] = { ...value, fontSize: Math.max(minimum, value.fontSize), lineHeight: Math.max(minimum + 5, 'lineHeight' in value ? value.lineHeight || 0 : 0) };
        }
      }
    }
    const patch = (key: string, value: ViewStyle | TextStyle) => {
      if (base[key]) result[key] = { ...result[key], ...value };
    };

    patch('page', { maxWidth, minWidth: 0, minHeight: 0 });
    patch('safe', { minWidth: 0, minHeight: 0, backgroundColor: colors.background });
    patch('flex', { minWidth: 0, minHeight: 0 });
    patch('header', { paddingHorizontal: padding, ...(desktop ? { backgroundColor: colors.background, borderBottomWidth: 0, paddingTop: 0, paddingBottom: 0 } : {}) });
    patch('content', { paddingHorizontal: padding });
    patch('list', { paddingHorizontal: padding });
    if (kind === 'list' && base.list) {
      const list = base.list as ViewStyle;
      const top = list.paddingTop ?? list.paddingVertical ?? list.padding ?? 0;
      patch('list', { paddingTop: Math.max(typeof top === 'number' ? top : 0, desktop ? 24 : 16) });
    }
    patch('navigation', { paddingHorizontal: padding, flexShrink: 0, ...(webNavigation ? { display: 'none' } : {}) });
    patch('header', { flexShrink: 0 });
    if (!desktop && (keyboardVisible || height < 400)) patch('header', { display: 'none' });
    if (height < 500) patch('content', { paddingTop: 12 });
    if (!desktop && height < 500) {
      patch('headerRow', { display: 'none' });
      patch('mobileHeaderRow', { display: 'none' });
      patch('headerFilters', { marginTop: 0 });
    }
    patch('navItem', { minWidth: 0, minHeight: 48 });
    patch('navLabel', { textAlign: 'center' });
    if (mobile) {
      patch('title', { fontSize: width < 360 ? 22 : 24, lineHeight: width < 360 ? 28 : 31 });
      patch('sectionTitle', { fontSize: 17, lineHeight: 23 });
      patch('content', { paddingHorizontal: padding, paddingTop: 14 });
      patch('list', { paddingHorizontal: padding });
      patch('card', { padding: width < 360 ? 12 : 14, borderRadius: 14, minWidth: 0 });
      patch('field', { marginBottom: 10, minWidth: 0 });
      patch('heading', { flexWrap: 'wrap', rowGap: 10, columnGap: 10 });
      patch('actions', { flexWrap: 'wrap', rowGap: 8, columnGap: 8 });
      patch('filters', { flexWrap: 'wrap', rowGap: 8, columnGap: 8 });
      patch('summaryGrid', { flexWrap: 'wrap', rowGap: 8, columnGap: 8 });
    } else if (tablet) {
      patch('content', { paddingTop: 20 });
      patch('card', { padding: 18, borderRadius: 16, minWidth: 0 });
    }
    const overlayPadding = width < 380 || height < 500 ? 12 : 24;
    patch('overlay', { paddingLeft: Math.max(overlayPadding, insets.left + 8), paddingRight: Math.max(overlayPadding, insets.right + 8), paddingTop: Math.max(overlayPadding, insets.top + 8), paddingBottom: Math.max(overlayPadding, insets.bottom + 8) });
    patch('modal', { maxHeight: '90%', minHeight: 0, minWidth: 0, flexShrink: 1, padding: width < 380 ? 16 : 22 });
    for (const key of ['input', 'searchInput', 'leadSearchInput', 'searchText']) patch(key, { minHeight: 48 });
    for (const key of ['primary', 'newLeadButton', 'filter', 'stageFilter', 'branchFilter', 'back', 'change', 'close', 'option', 'calendarControl', 'calendarDay', 'todayButton', 'cancel', 'assign', 'submit', 'saveButton', 'exportButton', 'addButton', 'secondary', 'retry']) patch(key, { minHeight: 44 });
    if (desktop) {
      patch('title', { fontSize: 30, lineHeight: 38 });
      patch('greeting', { fontSize: 32, lineHeight: 40 });
      patch('sectionTitle', { fontSize: 20, lineHeight: 28 });
      patch('headerFilters', { marginTop: 18 });
      patch('filters', { marginTop: 18 });
      patch('content', { paddingTop: 32 });
      patch('card', { borderColor: colors.border, padding: 20 });
      patch('runCard', { backgroundColor: colors.primaryLight, minHeight: 260 });
      for (const key of ['input', 'searchInput', 'inputText']) patch(key, { fontSize: 15 });
      patch('input', { minHeight: 48 });
      patch('searchInput', { minHeight: 48 });
    }

    for (const key of ['headerFilters', 'filters']) {
      if ('flexDirection' in (base[key] || {}) && base[key].flexDirection === 'row' && !('flexWrap' in base[key])) {
        patch(key, { flexDirection: contentWidth / fontScale < 220 ? 'column' : 'row', ...(wide ? { maxWidth: 600 } : {}) });
      }
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
    for (const key of ['grid', 'recordGrid', 'workspaceGrid']) {
      patch(key, { alignItems: 'stretch' });
    }
    patch('workspaceBody', { flex: 1 });
    patch('cardBody', { flex: 1 });
    if (contentWidth / fontScale < 260) {
      patch('heading', { flexDirection: 'column', alignItems: 'stretch' });
      patch('actions', { flexDirection: 'column', alignItems: 'stretch' });
      patch('decisionButtons', { flexDirection: 'column', alignItems: 'stretch' });
    }
    patch('summaryItem', { minWidth: 80 });
    patch('steps', { flexWrap: 'wrap', rowGap: 12 });
    patch('step', { minWidth: 80 });
    patch('detail', { width: compact ? '100%' : '50%' });
    patch('fullDetail', { width: '100%' });
    for (const key of ['name', 'rowTitle', 'filterText', 'company', 'companyName', 'statusText', 'workspaceTitle', 'title', 'cardTitle', 'modalTitle', 'monthTitle', 'inputText', 'eventTitle', 'taskTitle', 'primaryText', 'cancelText', 'assignText', 'submitText', 'buttonText', 'saveText']) {
      patch(key, { flexShrink: 1 });
    }
    for (const [key, value] of Object.entries(base)) {
      if ('width' in value && value.width === '46%') {
        const columns = key === 'workspace' || key === 'card'
          ? workspaceColumns
          : gridColumns;
        patch(key, { width: Math.max(0, (contentWidth - (columns - 1) * 12) / columns), flexGrow: 0, minWidth: 0 });
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

    for (const key of ['label', 'fieldLabel', 'inputLabel', 'filterLabel']) patch(key, { fontSize: 11, lineHeight: 16 });
    if (base.field) patch('field', { marginBottom: 12 });
    if (desktop) Object.assign(result, desktopStyles(result));

    return {
      styles: {
        ...result, formCard, fullField: { width: '100%' } as ViewStyle, listItem,
        headerIdentity: { display: desktop || height < 500 ? 'none' : 'flex' } as ViewStyle,
        splitLayout: { flexDirection: desktop && wide ? 'row' : 'column', gap: desktop && wide ? 24 : 0 } as ViewStyle,
        splitPanel: { flex: desktop && wide ? 1 : undefined, minWidth: 0 } as ViewStyle,
        panelMetric: { width: contentWidth / fontScale < 420 ? '100%' : '47%', flexGrow: 1 } as ViewStyle,
        fillPanel: { flex: desktop && wide ? 1 : undefined } as ViewStyle,
        responsiveRecordCard: { width: recordGrid.cardWidth, marginBottom: 0, minWidth: 0 } as ViewStyle,
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
      padding,
      recordGrid,
      workspaceGrid: adminGrid(contentWidth, fontScale, 'workspace', 12, screen),
      overviewGrid: adminGrid(contentWidth, fontScale, 'overview', 12, screen),
      splitPanels: desktop && wide,
      fontScale,
      columnWrapperStyle: { gap: 12, alignItems: 'stretch' } as ViewStyle,
    };
  }, [base, kind, width, height, fontScale, desktop, mobile, tablet, webNavigation, keyboardVisible, insets.left, insets.right, insets.top, insets.bottom]);
}

import { Platform, type ImageStyle, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Web workspace design tokens. The sidebar is the reference: navy navigation, a single
 * blue accent for selected/primary/focus states, 10px controls, 44px minimum control height.
 * Pages stay light; only the shell is navy.
 */
export const webWorkspaceTheme = {
  background: '#F5F7FB', surface: '#FFFFFF', text: '#17243B', muted: '#607089',
  border: '#E2E8F0', primary: '#2563EB', primaryLight: '#EFF5FF',
  navigation: '#101D35', navigationText: '#C5D1E4', accent: '#F4A45C',
  hover: '#F1F5FB', focusRing: '#93B8FF',
  radiusControl: 10, radiusCard: 14, controlHeight: 44,
  cardShadow: '0 2px 8px rgba(16,29,53,0.035), 0 12px 28px rgba(16,29,53,0.025)',
  menuShadow: '0 12px 28px rgba(16,29,53,0.16)',
};

type NamedStyles = Record<string, ViewStyle | TextStyle | ImageStyle>;

// Only replace legacy brand/neutral colors. Status and chart colors retain
// their meaning, and native styles pass through unchanged.
const legacyColors: Record<string, string> = {};
function aliases(target: string, values: string[]) {
  for (const value of values) legacyColors[value] = target;
}
aliases(webWorkspaceTheme.background, ['#edf2fa', '#f6f8fd', '#f6f7fb', '#f3f6fc', '#f3f6fd', '#f5f7fc', '#f7f9ff']);
aliases(webWorkspaceTheme.border, ['#d6e0ef', '#e4eaf5', '#dce3e7', '#d7e0ea', '#cddcd7', '#dce5ef', '#dce5f3', '#ccd6e5', '#edf1f8']);
aliases(webWorkspaceTheme.text, ['#1b2d4a', '#20334f', '#263246']);
aliases(webWorkspaceTheme.muted, ['#586d8b', '#405573', '#607591', '#71829c', '#8192ad']);
aliases(webWorkspaceTheme.primary, ['#3157d5', '#345cf2', '#2445b4', '#2457d6', '#1a73e8']);
aliases(webWorkspaceTheme.primaryLight, ['#e5ecff', '#eaf0ff', '#e9efff', '#edf1ff', '#f0f4ff']);

const COLOR_PROPERTIES = ['color', 'backgroundColor', 'borderColor', 'borderBottomColor', 'borderTopColor', 'borderLeftColor', 'borderRightColor'] as const;
const NAMED_CARDS = /^(card|workspace|moduleCard|profileCard|branchCard|shiftCard|runCard|modal|documentSheet)$/;
const ACTIONS = /^(button|primary|secondary|submit|saveButton|cancelButton|addButton|exportButton|assign|cancel|retry|documentSave|leaveApply|leaveCancel)$/;
const ACTION_TEXT = /^(buttonText|primaryText|secondaryText|submitText|saveText|cancelText|assignText|documentButtonText)$/;
const isWhite = (value: unknown) => typeof value === 'string' && /^#(fff|ffffff)$/i.test(value);

/** A bordered white panel with generous radius is a card, whatever the page called it. */
function looksLikeCard(style: TextStyle): boolean {
  return isWhite(style.backgroundColor) && !!style.borderWidth && typeof style.borderRadius === 'number'
    && style.borderRadius >= 14 && style.borderRadius < 40 && style.position !== 'absolute' && !style.flexShrink;
}

export function webWorkspaceStyles<T extends NamedStyles>(base: T): T {
  if (Platform.OS !== 'web') return base;
  return Object.fromEntries(Object.entries(base).map(([key, value]) => {
    const style = { ...value } as TextStyle;
    for (const property of COLOR_PROPERTIES) {
      const color = style[property];
      if (typeof color === 'string' && legacyColors[color.toLowerCase()]) style[property] = legacyColors[color.toLowerCase()];
    }
    // Surface elevation belongs to actual containers, never badges, rows,
    // transparent panel variants or the layout grid itself.
    if ((NAMED_CARDS.test(key) && style.backgroundColor && style.backgroundColor !== 'transparent') || looksLikeCard(style)) {
      style.backgroundColor = webWorkspaceTheme.surface;
      style.borderColor = webWorkspaceTheme.border;
      style.borderRadius = webWorkspaceTheme.radiusCard;
      style.boxShadow = webWorkspaceTheme.cardShadow;
    }
    // Only named action containers are normalized; text styles and icon controls
    // retain their own layout. Minimum heights still allow wrapped button labels.
    if (ACTIONS.test(key) && style.fontSize === undefined) {
      style.minHeight = Math.max(webWorkspaceTheme.controlHeight, Number(style.minHeight) || 0);
      style.borderRadius = webWorkspaceTheme.radiusControl;
      style.alignItems = 'center';
      style.justifyContent = 'center';
      style.paddingHorizontal = Math.max(12, Number(style.paddingHorizontal) || 0);
    }
    if (ACTION_TEXT.test(key) && typeof style.fontSize === 'number') {
      style.fontSize = 14;
      style.lineHeight = 20;
      style.fontWeight = '600';
      style.textAlign = 'center';
    }
    return [key, style];
  })) as T;
}

import React from 'react';
import Feather from '@expo/vector-icons/Feather';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import type { IconType } from 'react-icons';
import {
  LuActivity, LuCircleAlert, LuArrowLeft, LuArrowRight, LuArrowUpRight,
  LuChartNoAxesColumnIncreasing, LuBold, LuBriefcaseBusiness, LuCalendarDays,
  LuCheck, LuCircleCheck, LuSquareCheckBig, LuChevronDown, LuChevronLeft,
  LuChevronRight, LuChevronUp, LuCircle, LuClipboard, LuClock3, LuCode,
  LuWallet, LuDollarSign, LuDownload, LuSquarePen, LuEye, LuFile, LuFileText,
  LuFilter, LuGitBranch, LuLayoutGrid, LuHeadphones, LuCircleHelp, LuHouse,
  LuInfo, LuLink, LuList, LuLockKeyhole, LuLogIn, LuLogOut, LuMail, LuMenu,
  LuMinus, LuCircleMinus, LuEllipsis, LuNavigation, LuPackage, LuPhone,
  LuPhoneCall, LuPlus, LuRadio, LuRefreshCw, LuSearch, LuServer, LuSettings,
  LuShieldCheck, LuSlidersHorizontal, LuSquare, LuTablet, LuTrendingUp,
  LuType, LuUserRound, LuUserRoundCheck, LuUserRoundPlus, LuUsersRound,
  LuX, LuCircleX, LuBell, LuTarget, LuMapPin, LuSparkle,
} from 'react-icons/lu';
import { iconSymbols, type AppIconName } from './app-icon-symbols';
import { neutralIconInk, strongIconColor } from './iconAccent';

export type { AppIconName } from './app-icon-symbols';

// Reference-style outlines. Keep existing names and module meanings unchanged.
const outlines: Partial<Record<AppIconName, IconType>> = {
  activity: LuActivity, 'alert-circle': LuCircleAlert, 'arrow-left': LuArrowLeft,
  'arrow-right': LuArrowRight, 'arrow-up-right': LuArrowUpRight,
  'bar-chart-2': LuChartNoAxesColumnIncreasing, bold: LuBold, briefcase: LuBriefcaseBusiness,
  calendar: LuCalendarDays, check: LuCheck, 'check-circle': LuCircleCheck,
  'check-square': LuSquareCheckBig, 'chevron-down': LuChevronDown,
  'chevron-left': LuChevronLeft, 'chevron-right': LuChevronRight, 'chevron-up': LuChevronUp,
  circle: LuCircle, clipboard: LuClipboard, clock: LuClock3, code: LuCode,
  'credit-card': LuWallet, 'dollar-sign': LuDollarSign, download: LuDownload,
  edit: LuSquarePen, eye: LuEye, file: LuFile, 'file-text': LuFileText,
  filter: LuFilter, 'git-branch': LuGitBranch, grid: LuLayoutGrid, headphones: LuHeadphones,
  'help-circle': LuCircleHelp, home: LuHouse, info: LuInfo, link: LuLink, list: LuList,
  lock: LuLockKeyhole, 'log-in': LuLogIn, 'log-out': LuLogOut, mail: LuMail,
  menu: LuMenu, minus: LuMinus, 'minus-circle': LuCircleMinus, 'more-horizontal': LuEllipsis,
  navigation: LuNavigation, package: LuPackage, phone: LuPhone, 'phone-call': LuPhoneCall,
  plus: LuPlus, radio: LuRadio, 'refresh-cw': LuRefreshCw, search: LuSearch, server: LuServer,
  settings: LuSettings, shield: LuShieldCheck, sliders: LuSlidersHorizontal,
  square: LuSquare, tablet: LuTablet, 'trending-up': LuTrendingUp, type: LuType,
  user: LuUserRound, 'user-check': LuUserRoundCheck, 'user-plus': LuUserRoundPlus,
  users: LuUsersRound, x: LuX, 'x-circle': LuCircleX, bell: LuBell,
  target: LuTarget, 'map-pin': LuMapPin, star: LuSparkle,
};

type Props = {
  name?: AppIconName;
  symbol?: string;
  size?: number | string;
  color?: string;
  style?: StyleProp<TextStyle>;
};

export function AppIcon({ name, symbol, size, color, style }: Props) {
  if (!name && !symbol?.trim()) return null;
  const { fontFamily: _family, fontWeight: _weight, letterSpacing: _spacing,
    lineHeight: _lineHeight, fontSize, color: styleColor, ...layout } = StyleSheet.flatten(style) ?? {};
  const key = symbol?.trim() ?? '';
  const resolved = name ?? iconSymbols[key] ?? (Object.hasOwn(Feather.glyphMap, key) ? key as AppIconName : 'circle');
  const dimension = typeof size === 'number' ? size : resolved.startsWith('chevron-') ? 18 : Math.max(18, fontSize ?? 20);
  const requested = color ?? (typeof styleColor === 'string' ? styleColor : undefined);
  // Plain/neutral icons get the module accent; explicit semantic colours (white, red, pastel-on-navy…) are kept.
  const accent = !requested || neutralIconInk.has(requested.toLowerCase()) ? strongIconColor(resolved) : undefined;
  const ink = accent ?? requested ?? '#607591';
  const Outline = outlines[resolved];
  if (!Outline) return <Feather name={resolved} size={dimension} color={ink} style={layout}
    accessible={false} accessibilityElementsHidden importantForAccessibility="no" />;
  return <View pointerEvents="none" accessible={false} accessibilityElementsHidden importantForAccessibility="no"
    style={[{ width: dimension, height: dimension, flexShrink: 0, alignItems: 'center', justifyContent: 'center' }, layout as ViewStyle]}>
    <Outline size={dimension} color={ink} strokeWidth={2} aria-hidden="true" focusable="false" style={{ display: 'block', flexShrink: 0 }} />
  </View>;
}

export function createAppIcon(name: AppIconName) {
  return function Icon(props: Omit<Props, 'name' | 'symbol'>) {
    return <AppIcon {...props} name={name} />;
  };
}

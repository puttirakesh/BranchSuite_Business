import React from 'react';
import { View } from 'react-native';
import { AdminMenuIcon, type AdminMenuIconName } from './AdminMenuIcon';

type Props = { size?: number | string; color?: string };
function icon(name: AdminMenuIconName) {
  return function NativeIcon({ size = 18, color = '#5c79bd' }: Props) {
    const dimension = typeof size === 'number' && Number.isFinite(size) && size > 0 ? size : 18;
    return <View accessible={false} style={{ width: dimension, height: dimension, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ transform: [{ scale: dimension / 20 }] }}><AdminMenuIcon name={name} color={color} /></View>
    </View>;
  };
}

export const FiUsers = icon('people');
export const FiUserPlus = icon('people');
export const FiUser = icon('people');
export const FiCheckSquare = icon('file');
export const FiClock = icon('clock');
export const FiCreditCard = icon('wallet');
export const FiBarChart2 = icon('chart');
export const FiTrendingUp = icon('chart');
export const FiMoreHorizontal = icon('more');
export const FiSearch = icon('search');
export const FiX = icon('close');
export const FiBriefcase = icon('building');
export const FiFileText = icon('file');
export const FiList = icon('file');
export const FiHeadphones = icon('support');
export const FiHome = icon('home');
export const FiLock = icon('lock');
export const FiSettings = icon('settings');
export const FiPhone = icon('support');
export const FiCalendar = icon('file');

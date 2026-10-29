import React from 'react';
import { Text, View, useWindowDimensions } from 'react-native';
import { AdminPageHeading } from '../../ui/AdminPageHeading';
import { RESPONSIVE_BREAKPOINTS } from '../../ui/responsiveBreakpoints';
import { useEmployeeWorkspace } from './workspace';
import { useEmployeeStyles } from './styles';
import type { Page } from './data';

export function EmployeePageHeading({ title, backTo = 'home', children }: {
  title: string;
  backTo?: Page | null;
  children?: React.ReactNode;
}) {
  const { go } = useEmployeeWorkspace();
  const s = useEmployeeStyles();
  const { width } = useWindowDimensions();
  const sectionGap = width >= RESPONSIVE_BREAKPOINTS.desktop ? 12 : width >= RESPONSIVE_BREAKPOINTS.tablet ? 10 : 8;
  if (backTo === null) {
    return <View style={[s.between, { minHeight: 44, marginBottom: sectionGap }]}>
      <Text accessibilityRole="header" style={[s.title, { flex: 1, minWidth: 0 }]}>{title}</Text>
      {children}
    </View>;
  }
  return <AdminPageHeading title={title} onBack={() => go(backTo)} style={{ marginBottom: 16 }}>
    {children}
  </AdminPageHeading>;
}

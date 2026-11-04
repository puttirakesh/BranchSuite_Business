import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { colors } from '../../theme/tokens';
import { AppText } from './AppText';
import { Button } from './AppButton';

export function NotFoundScreen() {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24, backgroundColor: colors.bg }}>
      <AppText variant="h2">Page not found</AppText>
      <AppText variant="small">This address does not match any admin screen.</AppText>
      <Button label="Go to overview" onPress={() => router.replace('/dashboard')} />
    </View>
  );
}

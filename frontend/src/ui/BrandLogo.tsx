import React from 'react';
import { Image } from 'react-native';

export function BrandLogo({ size = 36 }: { size?: number }) {
  return (
    <Image
      source={require('../../assets/icon.png')}
      accessibilityLabel="BranchSuite Business logo"
      resizeMode="contain"
      style={{ width: size, height: size, borderRadius: size * 0.22, flexShrink: 0 }}
    />
  );
}

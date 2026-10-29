import React from 'react';
import AuthScreen from '../../shared/components/ui/AuthScreen';

export type LoginWebFrameProps = { brand: React.ReactNode; footer: React.ReactNode; children: React.ReactNode };

export default function LoginWebFrame({ brand, footer, children }: LoginWebFrameProps) {
  return <AuthScreen showBrand={false}>{brand}{children}{footer}</AuthScreen>;
}

import { formSpacing } from '../../theme/formSpacing';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { FloatingTextInput, type FloatingTextInputProps } from '../../../ui/FloatingTextInput';
import { colors } from '../../theme/colors';

type Props = FloatingTextInputProps & { label: string; error?: string; password?: boolean };

export default function AppInput({ label, error, password = false, ...props }: Props) {
  const [visible, setVisible] = useState(false);
  return <View style={s.wrapper}>
    <FloatingTextInput {...props} label={label} accessibilityLabel={props.accessibilityLabel || label}
      invalid={!!error} secureTextEntry={password ? !visible : props.secureTextEntry}
      autoCapitalize={props.autoCapitalize ?? 'none'}
      trailingAccessory={password ? <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'} onPress={() => setVisible(value => !value)} style={s.toggle}><Text style={s.toggleText}>{visible ? 'Hide' : 'Show'}</Text></Pressable> : undefined} />
    {!!error && <Text accessibilityRole="alert" style={s.error}>{error}</Text>}
  </View>;
}

const s = StyleSheet.create({
  wrapper: { marginBottom: formSpacing.field }, toggle: { minHeight: 44, paddingLeft: 8, justifyContent: 'center' },
  toggleText: { color: colors.primary, fontSize: 12, fontWeight: '600' },
  error: { color: colors.danger, fontSize: 12, marginTop: 5 },
});

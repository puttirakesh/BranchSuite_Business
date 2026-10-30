import { Pressable, Text, type PressableProps } from 'react-native';
import { colors } from '../../ui/theme';
export default function AppButton({ title, ...props }: PressableProps & { title: string }) { return <Pressable accessibilityRole="button" {...props} style={[{ minHeight: 48, padding: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary, opacity: props.disabled ? 0.5 : 1 }, typeof props.style === 'object' ? props.style : undefined]}><Text style={{ color: 'white', fontWeight: '700' }}>{title}</Text></Pressable>; }

import { Pressable, View } from 'react-native';
import { colors } from '../constants/colors';

export function PasswordToggle({ visible, disabled, onToggle }: { visible: boolean; disabled?: boolean; onToggle: () => void }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={visible ? 'Hide password' : 'Show password'}
    accessibilityState={{ disabled: !!disabled, checked: visible }} disabled={disabled} onPress={onToggle} hitSlop={2}
    style={({ pressed }) => ({ width: 44, height: 44, borderRadius: 8, alignItems: 'center', justifyContent: 'center', opacity: pressed || disabled ? 0.5 : 1 })}>
    <View accessible={false} importantForAccessibility="no-hide-descendants" style={{ width: 24, height: 24, justifyContent: 'center', alignItems: 'center' }}>
      <View style={{ width: 22, height: 14, borderWidth: 1.8, borderColor: colors.secondaryText, borderRadius: 12, justifyContent: 'center', alignItems: 'center' }}>
        <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.secondaryText }} />
      </View>
      {visible && <View style={{ position: 'absolute', width: 27, height: 2, backgroundColor: colors.secondaryText, transform: [{ rotate: '-45deg' }] }} />}
    </View>
  </Pressable>;
}

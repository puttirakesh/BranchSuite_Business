import { FloatingTextInput as TextInput, type FloatingTextInputProps } from "../../ui/FloatingTextInput";
import { AppIcon } from "../../ui/AppIcon";
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { colors } from './data';
import { useEmployeeStyles } from './styles';

export function RefreshButton({ label, onPress, loading = false, disabled = false, retry = false, iconOnly = false }: {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  retry?: boolean;
  iconOnly?: boolean;
}) {
  const s = useEmployeeStyles();
  const blocked = loading || disabled;
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled: blocked, busy: loading }} aria-busy={loading} disabled={blocked} onPress={onPress}
    style={({ pressed }) => [s.refreshButton, iconOnly && { width: 44, paddingHorizontal: 0 }, (pressed || blocked) && { opacity: 0.6 }]}>
    {loading ? <ActivityIndicator size="small" color={colors.primary} /> : <AppIcon name="refresh-cw" size={16} color={colors.primary} />}
    {!iconOnly && <Text style={s.refreshText}>{loading ? 'Refreshing…' : retry ? 'Retry' : 'Refresh'}</Text>}
  </Pressable>;
}

export function Button({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const s = useEmployeeStyles();
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      accessibilityState={{ disabled }}
      onPress={onPress}
      style={({ pressed }) => [
        s.button,
        secondary && s.secondary,
        (pressed || disabled) && { opacity: 0.65 },
      ]}
    >
      <Text style={[s.buttonText, secondary && { color: colors.primary }]}>
        {label}
      </Text>
    </Pressable>
  );
}
export function Badge({ label }: { label: string }) {
  const s = useEmployeeStyles();
  const status = label.toLowerCase().replace(/_/g, ' ');
  const green = ['paid', 'completed', 'checked in', 'shift complete', 'approved', 'verified'].includes(status);
  const red = ['rejected', 'cancelled', 'absent'].includes(status);
  return (
    <View style={[s.badge, { backgroundColor: green ? "#E2F4EC" : red ? '#FCE9EB' : "#FFF1DA" }]}>
      <Text style={[s.badgeText, { color: green ? "#217663" : red ? '#A33148' : "#945F16" }]}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Text>
    </View>
  );
}
// Draw the APK's outline icons with native views so the preview needs no extra packages.
export function WorkspaceIcon({ symbol, color = colors.primary, size = 24 }: { symbol: string; color?: string; size?: number }) {
  return <AppIcon symbol={symbol} color={color} size={size} />;
}
export function Icon({
  symbol,
  lavender = false,
  amber = false,
}: {
  symbol: string;
  lavender?: boolean;
  amber?: boolean;
}) {
  const s = useEmployeeStyles();
  return (
    <View style={[s.icon, lavender && { backgroundColor: "#EFE8FB" }, amber && { backgroundColor: "#FFF1DA" }]}>
      <WorkspaceIcon symbol={symbol} color={amber ? "#945F16" : lavender ? "#8056B9" : colors.primary} />
    </View>
  );
}
export function Tile({
  title,
  description,
  symbol,
  onPress,
  lavender = false,
  amber = false,
}: {
  title: string;
  description?: string;
  symbol: string;
  onPress: () => void;
  lavender?: boolean;
  amber?: boolean;
}) {
  const s = useEmployeeStyles();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        s.tile,
        pressed && { backgroundColor: "#F5FBF9" },
      ]}
    >
      <Icon symbol={symbol} lavender={lavender} amber={amber} />
      <View style={s.flex}>
        <Text style={s.cardTitle}>{title}</Text>
        {description ? <Text style={s.small}>{description}</Text> : null}
      </View>
      <WorkspaceIcon symbol="›" color="#9AA6B8" size={18} />
    </Pressable>
  );
}
export function Field({
  label,
  value,
  onChange,
  multiline = false,
  hint,
  error,
  ...inputProps
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  hint?: string;
  error?: string;
} & Omit<FloatingTextInputProps, 'value' | 'onChange' | 'onChangeText' | 'multiline'>) {
  const s = useEmployeeStyles();
  return (
    <View style={s.field}>

      <TextInput label={label}
        invalid={!!error}
        {...inputProps}
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
          !!error && { borderColor: '#B94D61' },
        ]}
      />
      {!!error ? <Text accessibilityRole="alert" style={s.error}>{error}</Text> : hint ? <Text style={s.small}>{hint}</Text> : null}
    </View>
  );
}

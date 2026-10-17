import { AppIcon } from "../../ui/AppIcon";
import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from './data';
import { useEmployeeStyles } from './styles';

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
  const green = ["Paid", "Completed", "Checked in", "Shift complete"].includes(
    label,
  );
  return (
    <View style={[s.badge, { backgroundColor: green ? "#E2F4EC" : "#FFF1DA" }]}>
      <Text style={[s.badgeText, { color: green ? "#217663" : "#945F16" }]}>
        {label}
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
  description: string;
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
        <Text style={s.small}>{description}</Text>
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
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  const s = useEmployeeStyles();
  return (
    <View style={s.field}>
      <Text style={s.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        multiline={multiline}
        placeholder={placeholder}
        placeholderTextColor="#819083"
        style={[
          s.input,
          multiline && { minHeight: 100, textAlignVertical: "top" },
        ]}
      />
    </View>
  );
}

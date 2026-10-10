import { Pressable, Text, TextInput, View } from 'react-native';
import { colors } from './data';
import { s } from './styles';

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
  const stroke = { borderColor: color, borderWidth: 1.7 };
  const line = (left: number, top: number, width: number, rotation = 0) => (
    <View style={{ position: "absolute", left, top, width, height: 1.7, backgroundColor: color, transform: [{ rotate: `${rotation}deg` }] }} />
  );
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
      <View style={{ width: 24, height: 24, transform: [{ scale: size / 24 }] }}>
        {symbol === "◷" ? <>
          <View style={[stroke, { position: "absolute", left: 3, top: 3, width: 18, height: 18, borderRadius: 10 }]} />
          {line(11, 8, 6, 90)}{line(12, 13, 5, 25)}
        </> : symbol === "♙" ? <>
          <View style={[stroke, { position: "absolute", left: 8, top: 3, width: 8, height: 8, borderRadius: 5 }]} />
          <View style={[stroke, { position: "absolute", left: 4, top: 14, width: 16, height: 8, borderTopLeftRadius: 9, borderTopRightRadius: 9 }]} />
        </> : symbol === "⌂" ? <>
          {line(2, 7, 12, -40)}{line(10, 7, 12, 40)}
          <View style={[stroke, { position: "absolute", left: 5, top: 10, width: 14, height: 11, borderTopWidth: 0, borderRadius: 2 }]} />
          <View style={[stroke, { position: "absolute", left: 10, top: 14, width: 5, height: 7, borderBottomWidth: 0 }]} />
        </> : symbol === "⌕" ? <>
          <View style={[stroke, { position: "absolute", left: 3, top: 3, width: 13, height: 13, borderRadius: 8 }]} />
          {line(14, 17, 8, 45)}
        </> : symbol === "calendar" ? <>
          <View style={[stroke, { position: "absolute", left: 3, top: 5, width: 18, height: 16, borderRadius: 1 }]} />
          {line(3, 10, 18)}{line(5, 4, 5, 90)}{line(14, 4, 5, 90)}
          {line(7, 14, 3)}{line(14, 14, 3)}{line(7, 18, 3)}
        </> : symbol === "document" ? <>
          <View style={[stroke, { position: "absolute", left: 6, top: 3, width: 13, height: 18, borderRadius: 2 }]} />
          {line(13, 6, 5, 45)}{line(9, 12, 7)}{line(9, 16, 7)}
        </> : symbol === "help" ? <>
          <View style={[stroke, { position: "absolute", left: 4, top: 3, width: 16, height: 16, borderRadius: 9, borderBottomWidth: 0 }]} />
          <View style={[stroke, { position: "absolute", left: 3, top: 12, width: 5, height: 8, borderRadius: 2, backgroundColor: "#FFF1DA" }]} />
          <View style={[stroke, { position: "absolute", left: 16, top: 12, width: 5, height: 8, borderRadius: 2, backgroundColor: "#FFF1DA" }]} />
          {line(12, 21, 6)}
        </> : symbol === "›" ? <>{line(9, 8, 8, 45)}{line(9, 14, 8, -45)}</> : symbol === "♧" ? <>
          <View style={[stroke, { position: "absolute", left: 3, top: 5, width: 18, height: 16, borderRadius: 3 }]} />
          {line(3, 10, 18)}{line(5, 4, 5, 90)}{line(14, 4, 5, 90)}{line(8, 16, 3, 40)}{line(10, 15, 6, -45)}
        </> : symbol === "☑" ? <>
          <View style={[stroke, { position: "absolute", left: 4, top: 3, width: 16, height: 18, borderRadius: 3 }]} />
          {line(7, 12, 4, 40)}{line(9, 11, 7, -45)}{line(8, 17, 8)}
        </> : <>
          <View style={[stroke, { position: "absolute", left: 3, top: 5, width: 18, height: 15, borderRadius: 3 }]} />
          <View style={[stroke, { position: "absolute", left: 14, top: 10, width: 8, height: 6, borderRadius: 2, backgroundColor: "white" }]} />
          {line(16, 12, 2)}
        </>}
      </View>
    </View>
  );
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

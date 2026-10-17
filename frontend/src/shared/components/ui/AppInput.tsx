
import React, { useState } from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  Platform,
  useWindowDimensions,
} from "react-native";
import { colors } from "../../theme/colors";

type Props = TextInputProps & {
  label: string;
  error?: string;
  password?: boolean;
};

export default function AppInput({
  label,
  error,
  password = false,
  ...props
}: Props) {
  const [visible, setVisible] = useState(false);
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === "web" && width >= 900;

  return (
    <View style={styles.wrapper}>
      <Text style={[styles.label, desktop && styles.desktopLabel]}>{label}</Text>

      <View style={[
        styles.inputBox,
        desktop && styles.desktopInputBox,
        !!error && styles.errorBorder,
      ]}>
        <TextInput
          {...props}
          style={[styles.input, desktop && styles.desktopInput, props.style]}
          placeholderTextColor={colors.muted}
          secureTextEntry={password && !visible}
          autoCapitalize={
            props.autoCapitalize ?? "none"
          }
        />

        {password && (
          <Pressable
            onPress={() => setVisible(!visible)}
            accessibilityRole="button"
            accessibilityLabel={
              visible ? "Hide password" : "Show password"
            }
            hitSlop={8}
          >
            <Text style={styles.toggle}>
              {visible ? "Hide" : "Show"}
            </Text>
          </Pressable>
        )}
      </View>

      {!!error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  desktopLabel: { fontSize: 12, fontWeight: "500", marginBottom: 6 },
  desktopInputBox: { minHeight: 40, borderRadius: 8, paddingHorizontal: 12 },
  desktopInput: { fontSize: 14, fontWeight: "400", paddingVertical: 8 },
  wrapper: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  inputBox: {
    minHeight: 52,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    minWidth: 0,
    fontSize: 15,
    color: colors.text,
    paddingVertical: 10,
  },
  toggle: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "600",
    paddingLeft: 12,
  },
  errorBorder: {
    borderColor: colors.danger,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 5,
  },
});

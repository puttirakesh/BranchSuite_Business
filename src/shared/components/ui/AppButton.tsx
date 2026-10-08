
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from "react-native";
import { colors } from "../../theme/colors";

type Props = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "outline";
  disabled?: boolean;
  style?: ViewStyle;
};

export default function AppButton({
  title,
  onPress,
  variant = "primary",
  disabled = false,
  style,
}: Props) {
  const outline = variant === "outline";

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        outline ? styles.outline : styles.primary,
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          outline && styles.outlineText,
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  outline: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  text: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
    textAlign: "center",
  },
  outlineText: {
    color: colors.primary,
  },
  pressed: {
    opacity: 0.8,
  },
  disabled: {
    opacity: 0.5,
  },
});

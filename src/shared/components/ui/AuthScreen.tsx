
import React, { ReactNode } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";

type Props = {
  children: ReactNode;
  wide?: boolean;
};

export default function AuthScreen({
  children,
  wide = false,
}: Props) {
  const { width } = useWindowDimensions();
  const isTablet = width >= 768;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            styles.scroll,
            {
              paddingHorizontal: width < 360 ? 16 : 24,
            },
          ]}
        >
          <View
            style={[
              styles.container,
              {
                maxWidth: wide ? 1080 : 460,
                paddingVertical: isTablet ? 48 : 24,
              },
            ]}
          >
            {children}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: colors.background,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
  },
  container: {
    width: "100%",
    alignSelf: "center",
  },
});

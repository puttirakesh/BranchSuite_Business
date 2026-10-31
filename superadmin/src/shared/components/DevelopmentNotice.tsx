import { StyleSheet, Text, View } from "react-native";
import { colors, spacing, typography } from "../../theme/tokens";

// Consolidates the existing unfinished routes; it does not implement their features.
export default function DevelopmentNotice({ module }: { module: string }) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>BranchSuite SuperAdmin</Text>
      <Text style={styles.subtitle}>{module} page is under development.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.xxl,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: colors.primary,
    textAlign: "center",
  },
  subtitle: {
    fontSize: typography.button,
    color: colors.muted,
    marginTop: spacing.md,
    textAlign: "center",
  },
});

import { KeyboardAwareScrollView as ScrollView } from '../../../ui/KeyboardAwareScrollView';

import React, { ReactNode } from "react";
import {
  Platform,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { colors } from "../../theme/colors";
import { BrandLogo } from "../../../ui/BrandLogo";


type Props = {
  children: ReactNode;
  wide?: boolean;
  showBrand?: boolean;
};

export default function AuthScreen({
  children,
  wide = false,
  showBrand = Platform.OS === "web",
}: Props) {
  const { width, height } = useWindowDimensions();
  const isTablet = width >= 768;
  return (
    <SafeAreaView style={styles.safe}>
      <View
        style={styles.flex}
      >
        <ScrollView
          style={styles.flex}
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
                paddingVertical: height < 500 ? 16 : isTablet ? 48 : 24,
              },
            ]}
          >
            {showBrand && <View style={styles.brand}>
              <BrandLogo size={64} />
              <Text style={styles.brandName}>BranchSuite</Text>
            </View>}
            {children}
          </View>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  brand: { alignItems: "center", gap: 12, marginBottom: 28 },
  brandName: { fontSize: 27, fontWeight: "800", color: colors.text },
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

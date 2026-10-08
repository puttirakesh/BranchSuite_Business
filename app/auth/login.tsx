
import React, { useState } from "react";
import {
  Alert,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";

import AuthScreen from "../../src/shared/components/ui/AuthScreen";
import AppButton from "../../src/shared/components/ui/AppButton";
import AppInput from "../../src/shared/components/ui/AppInput";
import { colors } from "../../src/shared/theme/colors";

type LoginRole = "business" | "employee";

export default function LoginScreen() {
  const router = useRouter();

  const [role, setRole] = useState<LoginRole>("business");
  const [business, setBusiness] = useState("");
  const [showBusinesses, setShowBusinesses] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({
    business: "",
    email: "",
    password: "",
  });

  // Temporary demo data.
  const businesses = [
    "5 Gen Educon",
  ];

  const validate = () => {
    const next = {
      business: business ? "" : "Select a business",
      email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
        ? ""
        : "Enter a valid email",
      password: password.trim()
        ? ""
        : "Enter your password",
    };

    setErrors(next);

    return !Object.values(next).some(Boolean);
  };

  const handleLogin = () => {
    if (!validate()) return;

    Alert.alert(
      "UI Demo",
      "Login form is ready. Your backend developer can connect authentication here."
    );
  };

  return (
    <AuthScreen>
      <View style={styles.logoBox}>
        <View style={styles.logo}>
          <Text style={styles.logoLetter}>B</Text>
        </View>

        <Text style={styles.brand}>BranchSuite</Text>
        <Text style={styles.tagline}>
          CRM • PEOPLE • PAYROLL
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.heading}>Welcome back</Text>

        <Text style={styles.subtitle}>
          Sign in to manage your business and daily work.
        </Text>

        <View style={styles.tabs}>
          {([
            ["business", "Business & Staff"],
            ["employee", "Employee"],
          ] as const).map(([value, label]) => (
            <Pressable
              key={value}
              onPress={() => setRole(value)}
              style={[
                styles.tab,
                role === value && styles.activeTab,
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  role === value && styles.activeTabText,
                ]}
              >
                {label}
              </Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.fieldLabel}>Business</Text>

        <Pressable
          style={styles.selector}
          onPress={() => setShowBusinesses(!showBusinesses)}
        >
          <Text style={{
            color: business ? colors.text : colors.muted,
          }}>
            {business || "Select your business"}
          </Text>

            <Text style={styles.arrow}>▾</Text>
        </Pressable>

        {showBusinesses && (
          <View style={styles.dropdown}>
            {businesses.map((item) => (
              <Pressable
                key={item}
                style={styles.dropdownItem}
                onPress={() => {
                  setBusiness(item);
                  setShowBusinesses(false);
                }}
              >
                <Text style={styles.dropdownText}>
                  {item}
                </Text>
              </Pressable>
            ))}
          </View>
        )}

        {!!errors.business && (
          <Text style={styles.error}>
            {errors.business}
          </Text>
        )}

        <View style={{ height: 18 }} />

        <AppInput
          label="Work email"
          placeholder="name@company.com"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoComplete="email"
          error={errors.email}
        />

        <AppInput
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={setPassword}
          password
          error={errors.password}
        />

        <Pressable
          style={styles.forgot}
          onPress={() => router.push("/auth/forgot-password")}
        >
          <Text style={styles.link}>
            Forgot password?
          </Text>
        </Pressable>

        <AppButton
          title="Sign In"
          onPress={handleLogin}
        />

        <View style={styles.divider}>
          <View style={styles.line} />
          <Text style={styles.or}>OR</Text>
          <View style={styles.line} />
        </View>

        <AppButton
          title="Explore Subscription Plans"
          variant="outline"
          onPress={() => router.push("/auth/plans")}
        />
      </View>

      <Text style={styles.footer}>
        © BranchSuite • Business Management
      </Text>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  logoBox: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 60,
    height: 60,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  logoLetter: {
    fontSize: 30,
    fontWeight: "800",
    color: "#FFFFFF",
  },
  brand: {
    fontSize: 27,
    fontWeight: "800",
    color: colors.text,
  },
  tagline: {
    color: colors.muted,
    fontSize: 11,
    letterSpacing: 2,
    marginTop: 5,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    borderWidth: 1,
    borderColor: colors.border,
  },
  heading: {
    fontSize: 23,
    fontWeight: "800",
    color: colors.text,
  },
  subtitle: {
    color: colors.muted,
    fontSize: 13,
    lineHeight: 20,
    marginTop: 7,
    marginBottom: 22,
  },
  tabs: {
    flexDirection: "row",
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: 4,
    marginBottom: 22,
  },
  tab: {
    flex: 1,
    minHeight: 42,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
    paddingHorizontal: 4,
  },
  activeTab: {
    backgroundColor: colors.primary,
  },
  tabText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
    textAlign: "center",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: colors.text,
    marginBottom: 8,
  },
  selector: {
    minHeight: 52,
    backgroundColor: colors.input,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  arrow: {
    color: colors.muted,
    fontSize: 20,
  },
  dropdown: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    marginTop: 5,
    backgroundColor: colors.surface,
    overflow: "hidden",
  },
  dropdownItem: {
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  dropdownText: {
    color: colors.text,
    fontSize: 14,
  },
  error: {
    color: colors.danger,
    fontSize: 12,
    marginTop: 5,
  },
  forgot: {
    alignSelf: "flex-end",
    marginBottom: 22,
    paddingVertical: 4,
  },
  link: {
    color: colors.primary,
    fontSize: 13,
    fontWeight: "700",
  },
  divider: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: colors.border,
  },
  or: {
    color: colors.muted,
    fontSize: 12,
  },
  footer: {
    textAlign: "center",
    marginTop: 26,
    color: colors.muted,
    fontSize: 11,
  },
});

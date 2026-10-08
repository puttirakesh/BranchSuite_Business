import axios from "axios";
import { useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
  useWindowDimensions,
  type TextInput,
} from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSession } from "../src/store/session";
import { Button, Card, ErrorNotice, Field, styles } from "../src/components/ui";
import { errorMessage } from "../src/services/api";
import { colors } from "../src/constants/colors";
import { inputLimits, validateLogin } from "../src/utils/validation";
import { demoBusinesses, type LoginPortal } from "../src/services/demo";
import { listTenants, type TenantOption } from "../src/services/authService";
import { PasswordToggle } from "../src/components/PasswordToggle";

export default function LoginScreen() {
  const { login, notice, portal: previousPortal } = useSession();
  const router = useRouter();
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const compact = width < 480 || height < 600;
  const passwordInput = useRef<TextInput>(null);
  const [portal, setPortal] = useState<LoginPortal>(previousPortal);
  const [tenants, setTenants] = useState<TenantOption[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const validation = validateLogin(email, password);
  useEffect(() => {
    let active = true;
    void listTenants()
      .then((data) => {
        if (active) setTenants(data);
      })
      .catch(() => {
        if (active)
          setError(
            "Could not load businesses. Check the backend URL and connection.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const choices = [
    ...tenants,
    ...demoBusinesses.map((b) => ({ id: b.id, name: `${b.name} (Demo)` })),
  ];
  const selected = choices.find((b) => b.id === tenantId);
  const fieldError = (field: string) =>
    submitted || touched[field] ? validation.errors[field] : undefined;
  async function submit() {
    if (busy) return;
    setSubmitted(true);
    setError("");
    if (!tenantId || !validation.input) {
      if (!tenantId) setError("Select your business.");
      return;
    }
    setBusy(true);
    try {
      await login(
        validation.input.email,
        validation.input.password,
        portal,
        tenantId,
      );
    } catch (err) {
      setError(
        axios.isAxiosError(err) && err.response?.status === 401
          ? "Invalid credentials or login type."
          : errorMessage(err),
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <KeyboardAvoidingView
      style={styles.page}
      keyboardVerticalOffset={insets.top}
      behavior={
        Platform.OS === "ios"
          ? "padding"
          : Platform.OS === "android"
            ? "height"
            : undefined
      }
    >
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: height < 600 ? "flex-start" : "center",
          padding: compact ? 16 : 32,
        }}
      >
        <View
          style={{
            maxWidth: 560,
            width: "100%",
            alignSelf: "center",
            gap: compact ? 16 : 24,
          }}
        >
          <View style={styles.row}>
            <View
              style={{
                width: 44,
                height: 44,
                borderRadius: 13,
                backgroundColor: "#305CEB",
                justifyContent: "center",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "#FFF", fontWeight: "800", fontSize: 18 }}>
                BS
              </Text>
            </View>
            <Text
              style={{
                color: colors.text,
                fontWeight: "800",
                fontSize: 23,
                flexShrink: 1,
              }}
            >
              BranchSuite Business
            </Text>
          </View>
          <View style={{ gap: 8 }}>
            <Text style={styles.title}>
              {portal === "employee" ? "Employee sign in" : "Business sign in"}
            </Text>
            <Text style={styles.muted}>
              Your company, branches and daily work in one place.
            </Text>
          </View>
          <View
            style={{
              flexDirection: "row",
              gap: 5,
              padding: 5,
              backgroundColor: "#E8EEFF",
              borderRadius: 14,
            }}
          >
            {(
              [
                ["staff", "Business Admin"],
                ["employee", "Employee"],
              ] as const
            ).map(([value, label]) => (
              <Pressable
                key={value}
                accessibilityRole="tab"
                accessibilityState={{ selected: portal === value }}
                disabled={busy}
                onPress={() => {
                  setPortal(value);
                  setSubmitted(false);
                  setError("");
                }}
                style={{
                  flex: 1,
                  minHeight: 48,
                  padding: 8,
                  justifyContent: "center",
                  alignItems: "center",
                  borderRadius: 10,
                  backgroundColor: portal === value ? "#FFF" : "transparent",
                }}
              >
                <Text
                  style={{
                    fontWeight: "700",
                    fontSize: 13,
                    color: portal === value ? "#305CEB" : colors.secondaryText,
                  }}
                >
                  {label}
                </Text>
              </Pressable>
            ))}
          </View>
          <Card>
            <Text style={styles.heading}>Welcome back</Text>
            {notice && <Text style={styles.muted}>{notice}</Text>}
            {error ? <ErrorNotice message={error} /> : null}
            <Text style={styles.muted}>Business</Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerOpen((v) => !v)}
              disabled={busy}
              style={{
                padding: 14,
                borderWidth: 1,
                borderColor: "#CBD5E1",
                borderRadius: 10,
              }}
            >
              <Text>{selected?.name ?? "Select business ▾"}</Text>
            </Pressable>
            {pickerOpen && (
              <ScrollView
                nestedScrollEnabled
                style={{ maxHeight: 190 }}
                keyboardShouldPersistTaps="always"
              >
                {choices.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setTenantId(item.id);
                      setPickerOpen(false);
                      setError("");
                    }}
                    style={{
                      padding: 12,
                      borderBottomWidth: 1,
                      borderBottomColor: "#E5E7EB",
                    }}
                  >
                    <Text>{item.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
            <Field
              label="Work email"
              value={email}
              onChangeText={(v) => {
                setEmail(v);
                setError("");
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              error={fieldError("email")}
              maxLength={inputLimits.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              autoComplete="email"
              editable={!busy}
              returnKeyType="next"
              onSubmitEditing={() => passwordInput.current?.focus()}
            />
            <Field
              label="Password"
              ref={passwordInput}
              value={password}
              onChangeText={(v) => {
                setPassword(v);
                setError("");
              }}
              onBlur={() => setTouched((prev) => ({ ...prev, password: true }))}
              error={fieldError("password")}
              maxLength={inputLimits.password}
              autoCapitalize="none"
              autoCorrect={false}
              secureTextEntry={!showPassword}
              autoComplete="current-password"
              editable={!busy}
              returnKeyType="go"
              onSubmitEditing={() => {
                void submit();
              }}
              rightAccessory={
                <PasswordToggle
                  visible={showPassword}
                  disabled={busy}
                  onToggle={() => setShowPassword((v) => !v)}
                />
              }
            />
            <Pressable
              onPress={() =>
                router.push({
                  pathname: "/forgot-password",
                  params: { tenantId, email },
                })
              }
              style={{ alignSelf: "flex-end", paddingVertical: 10 }}
            >
              <Text style={{ color: "#305CEB", fontWeight: "700" }}>
                Forgot password?
              </Text>
            </Pressable>
            <Button
              title="Sign in"
              busy={busy}
              onPress={() => {
                void submit();
              }}
            />
          </Card>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

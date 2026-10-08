import { useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Button, Card, ErrorNotice, Field, styles } from "../src/components/ui";
import { forgotPassword } from "../src/services/authService";
import { errorMessage } from "../src/services/api";
import { emailError } from "../src/utils/validation";

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ tenantId?: string; email?: string }>();
  const [tenantId, setTenantId] = useState(params.tenantId ?? "");
  const [email, setEmail] = useState(params.email ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  async function send() {
    const invalid = emailError(email, true);
    if (invalid) {
      setError(invalid);
      return;
    }
    if (!tenantId) {
      setError("Return to sign in and select your business first.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await forgotPassword(tenantId, email);
      setDone(true);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      style={styles.page}
      contentContainerStyle={{
        flexGrow: 1,
        padding: 20,
        justifyContent: "center",
      }}
    >
      <View
        style={{ width: "100%", maxWidth: 520, alignSelf: "center", gap: 16 }}
      >
        <Text style={styles.title}>Forgot password</Text>
        <Text style={styles.muted}>
          We'll email a time-limited link to your registered address.
        </Text>
        <Card>
          {done ? (
            <Text style={styles.muted}>
              If the account exists, a password reset link has been sent.
            </Text>
          ) : (
            <>
              {!!error && <ErrorNotice message={error} />}
              <Field
                label="Business ID"
                value={tenantId}
                editable={!busy}
                onChangeText={setTenantId}
                autoCapitalize="none"
              />
              <Field
                label="Work email"
                value={email}
                editable={!busy}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />
              <Button
                title="Send reset link"
                busy={busy}
                onPress={() => {
                  void send();
                }}
              />
            </>
          )}
          <Button
            variant="secondary"
            title="Back to sign in"
            onPress={() => router.replace("/login")}
          />
        </Card>
      </View>
    </ScrollView>
  );
}

import { useToastState } from '../../src/ui/useToastState';
import { InputValidationError } from '../../src/shared/validation/request';
import { AppIcon } from "../../src/ui/AppIcon";


import React, { useEffect, useRef, useState } from "react";
import { withMinimumWait } from '../../src/core/auth/minimum-wait';
import { toast } from '../../src/ui/toast-store';



import {

  ActivityIndicator,


  Pressable,

  StyleSheet,

  Text,

  View,

} from "react-native";



import { useRouter } from "expo-router";

import axios from "axios";



import AuthScreen from "../../src/shared/components/ui/AuthScreen";

import AppButton from "../../src/shared/components/ui/AppButton";

import AppInput from "../../src/shared/components/ui/AppInput";



import { colors } from "../../src/shared/theme/colors";

import { useAuth } from "../../src/core/auth/AuthProvider";



// =====================================================

// LOGIN TYPES

// =====================================================



type LoginRole = "business" | "employee";



type LoginErrors = {

  email: string;

  password: string;

};



const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;



// =====================================================

// LOGIN SCREEN

// =====================================================



export default function LoginScreen() {

  const router = useRouter();



  const { signIn, loading } = useAuth();



  // =====================================================

  // STATE

  // =====================================================



  const [role, setRole] = useState<LoginRole>("business");



  const [email, setEmail] = useState("");

  const [password, setPassword] = useState("");



  const [submitting, setSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  const [loginError, setLoginError] = useToastState("", 'error');

  const [errors, setErrors] = useState<LoginErrors>({

    email: "",

    password: "",

  });



  const isBusy = submitting || loading;



  // =====================================================

  // EMAIL INPUT HANDLER

  // =====================================================



  const handleEmailChange = (value: string) => {

    setEmail(value);



    if (errors.email) {

      setErrors((current) => ({

        ...current,

        email: "",

      }));

    }

  };



  // =====================================================

  // PASSWORD INPUT HANDLER

  // =====================================================



  const handlePasswordChange = (value: string) => {

    setPassword(value);



    if (errors.password) {

      setErrors((current) => ({

        ...current,

        password: "",

      }));

    }

  };



  // =====================================================

  // SELECT LOGIN ROLE

  // =====================================================



  const handleRoleChange = (value: LoginRole) => {

    if (isBusy) {

      return;

    }



    setRole(value);



    setErrors({

      email: "",

      password: "",

    });

  };



  // =====================================================

  // VALIDATE LOGIN FORM

  // =====================================================



  const validate = (): boolean => {

    const normalizedEmail = email.trim().toLowerCase();



    const nextErrors: LoginErrors = {

      email: "",

      password: "",

    };



    if (!normalizedEmail) {

      nextErrors.email = "Work email is required.";

    } else if (

      !EMAIL_REGEX.test(normalizedEmail) ||

      normalizedEmail.length > 254

    ) {

      nextErrors.email = "Enter a valid work email.";

    }



    if (!password) {

      nextErrors.password = "Enter your password.";

    }



    setErrors(nextErrors);



    return !Object.values(nextErrors).some(Boolean);

  };



  // =====================================================

  // HANDLE LOGIN

  // =====================================================



  const handleLogin = async () => {

    if (isBusy || submittingRef.current) {

      return;

    }



    if (!validate()) {

      return;

    }



    submittingRef.current = true;
    setSubmitting(true);

    setLoginError("");



    try {

      const portal =

        role === "business" ? "staff" : "employee";



      // Authenticate through AuthProvider.

      //

      // AuthProvider handles the existing login

      // API and session persistence.



      await withMinimumWait(signIn(

        email.trim().toLowerCase(),

        password,

        portal

      ));

      if (!mounted.current) return;
      toast.success('Signed in successfully.');



      // Clear the password field.

      setPassword("");



      // Navigate to the appropriate portal.

      if (role === "business") {

        router.replace("/admin");

      } else {

        router.replace("/employee");

      }

    } catch (error: unknown) {
      if (error instanceof InputValidationError) { setLoginError(error.message); return; }

      let message =

        "Unable to sign in. Please try again.";



      if (axios.isAxiosError(error)) {

        if (!error.response) {

          message =

            "Can't reach the server. Check your Wi-Fi, " +

            "API URL, and backend status.";

        } else {

          const serverMessage: unknown =

            error.response.data?.message;



          if (Array.isArray(serverMessage)) {

            message = serverMessage.join("\n");

          } else if (typeof serverMessage === "string") {

            message = serverMessage;

          } else if (error.response.status === 401) {

            message =

              "Invalid credentials or portal selection.";

          } else if (error.response.status >= 500) {

            message =

              "The server is temporarily unavailable. " +

              "Please try again later.";

          }

        }

      } else if (error instanceof Error) {

        message = error.message;

      }



      setLoginError(message);

    } finally {

      submittingRef.current = false;
      if (mounted.current) setSubmitting(false);

    }

  };



  // =====================================================

  // FORGOT PASSWORD NAVIGATION

  // =====================================================



  const handleForgotPassword = () => {

    if (isBusy) {

      return;

    }



    // Opens the Forgot Password screen.

    //

    // That screen calls:

    // POST /api/v1/auth/forgot-password

    //

    // The user can then navigate to the

    // Reset Password screen.



    router.push("/auth/forgot-password");

  };



  // =====================================================

  // SUBSCRIPTION PLANS NAVIGATION

  // =====================================================



  const handleExplorePlans = () => {

    if (isBusy) {

      return;

    }



    router.push("/auth/plans");

  };



  // =====================================================

  // RENDER

  // =====================================================



  return (

    <AuthScreen>

      {/* LOGIN CARD */}



      <View style={styles.card}>

        <Text style={styles.heading}>

          Welcome back

        </Text>






        {/* LOGIN PORTAL TABS */}



        <View style={styles.tabs}>

          {(

            [

              ["business", "Business & Staff"],

              ["employee", "Employee"],

            ] as const

          ).map(([value, label]) => (

            <Pressable

              key={value}

              disabled={isBusy}

              onPress={() => handleRoleChange(value)}

              style={[

                styles.tab,

                role === value && styles.activeTab,

              ]}

              accessibilityRole="tab"

              accessibilityState={{

                selected: role === value,

                disabled: isBusy,

              }}

            >

              <Text

                style={[

                  styles.tabText,

                  role === value &&

                  styles.activeTabText,

                ]}

              >

                {label}

              </Text>

            </Pressable>

          ))}

        </View>



        {/* EMAIL INPUT */}



        <AppInput validation={{ required: true }}

          label="Work email"

          value={email}

          onChangeText={handleEmailChange}

          keyboardType="email-address"

          autoComplete="email"

          error={errors.email}

        />



        {/* PASSWORD INPUT */}



        <AppInput validation={{ kind: 'password', required: true, minLength: 1 }}

          label="Password"

          value={password}

          onChangeText={handlePasswordChange}

          password

          error={errors.password}

        />



        {/* FORGOT PASSWORD LINK */}



        <Pressable

          style={styles.forgot}

          disabled={isBusy}

          onPress={handleForgotPassword}

          accessibilityRole="button"

          accessibilityLabel="Forgot password"

          accessibilityState={{

            disabled: isBusy,

          }}

        >

          <Text style={styles.link}>

            Forgot password

          </Text>

        </Pressable>





        {!!loginError && (

          <Text

            style={styles.loginError}

            accessibilityRole="alert"

          >

            {loginError}

          </Text>

        )}



        {/* SIGN IN BUTTON */}



        <AppButton

          title={

            submitting

              ? "Signing in..."

              : "Sign In"

          }

          onPress={handleLogin}
          busy={submitting}

          disabled={isBusy}

        />



        {/* LOADING INDICATOR */}



        {submitting ? (

          <View style={styles.loadingContainer}>

            <ActivityIndicator

              color={colors.primary}

            />



            <Text style={styles.loadingText}>

              Signing in securely...

            </Text>

          </View>

        ) : null}
        {/* Subscription plans are available only in Business & Staff portal. */}
        {role === "business" && (
          <>
            <View style={styles.divider}>
              <View style={styles.line} />
              <Text style={styles.or}>OR</Text>
              <View style={styles.line} />
            </View>
            <AppButton
              title="Explore Subscription Plans"
              variant="outline"
              disabled={isBusy}
              onPress={handleExplorePlans}
            />
          </>
        )}

      </View>



      {/* FOOTER */}



      

    </AuthScreen>

  );

}



// =====================================================

// STYLES

// =====================================================



const styles = StyleSheet.create({

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



  // =====================================================

  // LOGIN ROLE TABS

  // =====================================================



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



  // =====================================================

  // FORGOT PASSWORD LINK

  // =====================================================



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



  // =====================================================

  // LOADING INDICATOR

  // =====================================================



  loadingContainer: {

    flexDirection: "row",

    alignItems: "center",

    justifyContent: "center",

    gap: 10,

    marginTop: 12,

  },



  loadingText: {

    color: colors.muted,

    fontSize: 12,

  },



  // =====================================================

  // DIVIDER

  // =====================================================



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



  // =====================================================

  // FOOTER

  // =====================================================



  footer: {

    textAlign: "center",

    marginTop: 26,

    color: colors.muted,

    fontSize: 11,

  },



  loginError: {

  color: colors.danger,

  fontSize: 13,

  lineHeight: 19,

  marginBottom: 14,

},
});

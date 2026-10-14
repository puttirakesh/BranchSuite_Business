
import React from "react";

import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import {
  Redirect,
  Slot,
} from "expo-router";

import {
  SafeAreaView,
} from "react-native-safe-area-context";

import {
  BlurTargetView,
} from "expo-blur";

import {
  colors,
  navigation,
} from "./data";

import {
  Button,
  WorkspaceIcon,
} from "./components";

import { s } from "./styles";

import {
  useEmployeeWorkspace,
} from "./workspace";

import { EmployeeDialogs } from "./dialogs";
// =====================================================
// PAGE TITLES
// =====================================================

const pageTitles = {
  home: "My work",
  attendance: "My attendance",
  tasks: "My tasks",
  payroll: "My payroll",
  leave: "Leave & requests",
  profile: "My profile",
  documents: "My documents",
  advances: "Salary advances",
  help: "Help",
} as const;

// =====================================================
// EMPLOYEE INITIALS
// =====================================================

function getInitials(name: string): string {
  const parts = name
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "E";
  }

  if (parts.length === 1) {
    return parts[0]
      .slice(0, 2)
      .toUpperCase();
  }

  return (
    parts[0].charAt(0) +
    parts[parts.length - 1].charAt(0)
  ).toUpperCase();
}

// =====================================================
// EMPLOYEE SHELL
// =====================================================

export function EmployeeShell() {
  const {
    compact,
    desktop,
    page,

    signedOut,

    loaded,
    message,
    storageError,

    setDialog,
    setQuery,

    today,
    scroll,
    blurTarget,
    go,

    employeeName,
    employeeCompany,
    employeeBranch,
    employeeId,

    profileLoading,
    profileError,
  } = useEmployeeWorkspace();

  const title = pageTitles[page];

  const initials = getInitials(employeeName);

  const formattedDate = new Date(
    `${today}T12:00:00`,
  ).toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const shortDate = new Date(
    `${today}T12:00:00`,
  ).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  const companyLabel =
    employeeCompany !== "Not assigned"
      ? employeeCompany
      : "BranchSuite Business";

  const branchLabel =
    employeeBranch !== "Not assigned"
      ? employeeBranch
      : "Branch not assigned";

  const subtitles = {
    home: `${formattedDate} · ${branchLabel}`,
    attendance: "Your shifts and attendance records.",
    tasks: "Only work assigned to you. Update your progress and completion.",
    payroll: "Your available payroll and payslip information.",
    leave: "Apply for leave and track approval status.",
    profile: "Your employment details and self-service options.",
    documents: "Your available employment documents.",
    advances: "Request and track salary advances.",
    help: "Help with your employee workspace.",
  };

  const activeNavPage =
    ["documents", "advances", "help"].includes(page)
      ? "profile"
      : page;

  // ===================================================
  // NAVIGATION
  // ===================================================

  function renderNavigation(sidebar: boolean) {
    return navigation
      .filter(
        (item) =>
          sidebar ||
          item.page !== "leave",
      )
      .map((item) => {
        const selected =
          activeNavPage === item.page;

        return (
          <Pressable
            key={item.page}
            accessibilityRole="tab"
            accessibilityState={{
              selected,
            }}
            onPress={() => go(item.page)}
            style={[
              sidebar
                ? s.sideItem
                : s.navItem,

              selected &&
                (sidebar
                  ? s.sideActive
                  : s.navActive),
            ]}
          >
            <WorkspaceIcon
              symbol={item.symbol}
              color={
                selected
                  ? colors.primary
                  : colors.muted
              }
              size={
                sidebar
                  ? 22
                  : 21
              }
            />

            <Text
              style={[
                sidebar
                  ? s.sideLabel
                  : s.navLabel,

                selected && {
                  color: colors.primary,
                  fontWeight: "700",
                },
              ]}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      });
  }

  // ===================================================
  // SIGNED OUT
  // ===================================================

  if (signedOut) {
    return <Redirect href="/auth/login" />;
  }

  // ===================================================
  // RENDER
  // ===================================================

  return (
    <SafeAreaView
      style={s.safe}
      edges={["top", "bottom"]}
    >
      <BlurTargetView
        ref={blurTarget}
        style={s.shell}
      >
        {/* DESKTOP SIDEBAR */}

        {desktop && (
          <View style={s.sidebar}>
            {/* APP BRAND */}

            <View
              style={[
                s.row,
                {
                  marginBottom: 35,
                },
              ]}
            >
              <View style={s.brandIcon}>
                <WorkspaceIcon
                  symbol="♙"
                  color="white"
                />
              </View>

              <View>
                <Text style={s.brand}>
                  BranchSuite
                </Text>

                <Text style={s.small}>
                  Employee
                </Text>
              </View>
            </View>

            <Text style={s.caption}>
              MY WORKSPACE
            </Text>

            {renderNavigation(true)}

            {/* LOGGED-IN EMPLOYEE */}

            <View style={s.sideFooter}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Open my profile"
                onPress={() => go("profile")}
                style={s.row}
              >
                <View style={s.avatar}>
                  <Text style={s.avatarText}>
                    {initials}
                  </Text>
                </View>

                <View
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >
                  <Text
                    style={s.cardTitle}
                    numberOfLines={1}
                  >
                    {employeeName}
                  </Text>

                  <Text
                    style={s.small}
                    numberOfLines={1}
                  >
                    {employeeId
                      ? `Employee ID: ${employeeId}`
                      : "Employee"}
                  </Text>
                </View>
              </Pressable>

              <Text style={s.localHint}>
                {branchLabel}
              </Text>
            </View>
          </View>
        )}

        {/* MAIN CONTENT */}

        <View style={s.flex}>
          {/* TOP HEADER */}

          <View
            style={[
              s.topbar,
              compact && s.topbarCompact,
            ]}
          >
            <View
              style={[
                s.flex,
                compact && s.topbarMeta,
              ]}
            >
              <Text
                style={[
                  s.cardTitle,
                  compact && {
                    fontSize: 14,
                  },
                ]}
                numberOfLines={1}
              >
                {companyLabel}
              </Text>

              <Text
                style={[
                  s.small,
                  {
                    fontSize: 11,
                  },
                  compact && {
                    fontSize: 10,
                  },
                ]}
                numberOfLines={1}
              >
                {branchLabel}
                {" · "}
                Employee workspace
              </Text>
            </View>

            <View style={s.topbarActions}>
              {/* SEARCH */}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Find a module"
                onPress={() => {
                  setQuery("");
                  setDialog("search");
                }}
                style={s.searchButton}
              >
                <WorkspaceIcon
                  symbol="⌕"
                  color={colors.ink}
                  size={22}
                />
              </Pressable>

              {/* PROFILE AVATAR */}

              <Pressable
                accessibilityRole="button"
                accessibilityLabel="My profile"
                onPress={() => go("profile")}
                style={s.avatar}
              >
                <Text style={s.avatarText}>
                  {initials}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* SCROLLABLE CONTENT */}

          <ScrollView
            ref={scroll}
            contentContainerStyle={[
              s.content,
              {
                maxWidth: 1240,
                width: "100%",
                alignSelf: "center",
              },
              compact
                ? {
                    paddingHorizontal: 16,
                    paddingTop: 20,
                  }
                : desktop
                  ? {
                      padding: 32,
                    }
                  : {
                      padding: 24,
                    },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* BACK TO PROFILE */}

            {["advances", "help"].includes(page) && (
              <Button
                label="Back to profile"
                secondary
                onPress={() => go("profile")}
              />
            )}

            {/* PAGE HEADERS */}

            {page === "documents" ? (
              <View
                style={[
                  s.row,
                  {
                    alignItems: "flex-start",
                    marginBottom: 20,
                  },
                ]}
              >
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Back to profile"
                  onPress={() => go("profile")}
                  style={s.documentBack}
                >
                  <Text style={s.cardTitle}>
                    ‹
                  </Text>
                </Pressable>

                <View style={s.flex}>
                  <Text
                    style={[
                      s.caption,
                      {
                        marginBottom: 6,
                      },
                    ]}
                  >
                    BRANCHSUITE WORKSPACE
                  </Text>

                  <Text
                    accessibilityRole="header"
                    style={s.title}
                  >
                    {title}
                  </Text>

                  <Text
                    style={[
                      s.subtitle,
                      {
                        marginBottom: 0,
                      },
                    ]}
                  >
                    {subtitles[page]}
                  </Text>
                </View>
              </View>
            ) : page === "leave" ? null : (
              <>
                <Text
                  accessibilityRole="header"
                  style={s.title}
                >
                  {title}
                </Text>

                <Text style={s.subtitle}>
                  {subtitles[page]}
                </Text>
              </>
            )}

            {/* PROFILE LOADING */}

            {profileLoading && (
              <View
                style={[
                  s.row,
                  {
                    marginBottom: 14,
                    gap: 10,
                  },
                ]}
              >
                <ActivityIndicator
                  size="small"
                  color={colors.primary}
                />

                <Text style={s.small}>
                  Loading employee details...
                </Text>
              </View>
            )}

            {/* PROFILE ERROR */}

            {!!profileError && (
              <Text
                accessibilityRole="alert"
                style={s.error}
              >
                {profileError}
              </Text>
            )}

            {/* LOCAL STORAGE ERROR */}

            {storageError && (
              <Text
                accessibilityRole="alert"
                style={s.error}
              >
                Local document and workspace storage
                could not be read. Unsaved local
                changes may not persist.
              </Text>
            )}

            {/* PAGE CONTENT */}

            {!loaded ? (
              <ActivityIndicator
                color={colors.primary}
                style={{
                  margin: 40,
                }}
              />
            ) : (
              <>
                <Slot />

                <Text
                  style={[
                    s.footer,
                    page === "leave" &&
                      s.leaveFooter,
                  ]}
                >
                  BranchSuite Business
                  {" · "}
                  {page === "leave"
                    ? `${shortDate} · `
                    : ""}
                  Employee Workspace
                </Text>
              </>
            )}
          </ScrollView>

          {/* MOBILE / TABLET NAVIGATION */}

          {!desktop && (
            <View
              accessibilityRole="tablist"
              style={s.bottomNav}
            >
              {renderNavigation(false)}
            </View>
          )}
        </View>
      </BlurTargetView>

      {/* WORKSPACE NOTIFICATION */}

      {!!message && (
        <View
          accessibilityRole="alert"
          style={[
            s.toast,
            {
              bottom: desktop
                ? 24
                : 92,
            },
          ]}
        >
          <Text style={s.toastText}>
            {message}
          </Text>
        </View>
      )}

      {/* EXISTING EMPLOYEE DIALOGS */}

      <EmployeeDialogs />
    </SafeAreaView>
  );
}

import { KeyboardAwareScrollView as ScrollView } from '../../ui/KeyboardAwareScrollView';
import { AdminPageHeading } from '../../ui/AdminPageHeading';
import { AppIcon } from "../../ui/AppIcon";
import { BrandLogo } from "../../ui/BrandLogo";

import React, { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";

import {
  Redirect,
  Slot,
  usePathname,
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

import { useEmployeeStyles } from "./styles";

import {
  useEmployeeWorkspace,
} from "./workspace";

import { EmployeeDialogs } from "./dialogs";
import { WorkspaceNavigation, WorkspaceNavigationDrawer } from '../../ui/WorkspaceNavigation';
import { useSidebarPreference } from '../../ui/useSidebarPreference';
import { employeeSidebarDestinations, webWorkspaceLayout } from '../../ui/workspace-navigation';
import { useAdminViewport } from '../../ui/useAdminViewport';
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
  const { keyboardVisible } = useAdminViewport();
  const s = useEmployeeStyles();
  const pathname = usePathname();
  const isTaskDetail = /^\/employee\/tasks\/[^/]+\/?$/.test(pathname);
  const {
    compact,
    width,
    tablet,
    desktop: nativeDesktop,
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
    refreshProfile,
    assignedProfiles,
    selectedProfileId,
    setSelectedProfileId,
    dialog,
    attendanceSaving,
    leaveSaving,
    signOutEmployee,
  } = useEmployeeWorkspace();
  const { sidebarCollapsed, toggleSidebar } = useSidebarPreference();
  const navigationLayout = webWorkspaceLayout(width, sidebarCollapsed);
  const desktop = Platform.OS === 'web' ? navigationLayout.persistentSidebar : nativeDesktop;
  const webNavigation = Platform.OS === 'web' ? navigationLayout.webNavigation : nativeDesktop;
  const sidebarWidth = Platform.OS === 'web' ? navigationLayout.sidebarWidth : 224;
  const [navigationOpen, setNavigationOpen] = useState(false);
  useEffect(() => setNavigationOpen(false), [pathname, desktop, webNavigation]);
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }); }, [pathname, scroll]);
  const navigationProps = {
    workspace: 'Employee', items: employeeSidebarDestinations, pathname,
    userName: employeeName, companyName: employeeCompany, onSignOut: signOutEmployee,
  };

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


  const activeNavPage =
    isTaskDetail ? "tasks" : ["documents", "advances", "help"].includes(page)
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
            aria-selected={selected}
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
        nativeID="employee-workspace"
        style={s.shell}
      >
        {/* DESKTOP SIDEBAR */}

        {desktop && <View testID="desktop-sidebar" style={{ width: sidebarWidth, minHeight: 0, flexShrink: 0, zIndex: 40 }}><WorkspaceNavigation {...navigationProps} collapsed={Platform.OS === 'web' && sidebarCollapsed} onToggle={Platform.OS === 'web' ? toggleSidebar : undefined} /></View>}

        {/* MAIN CONTENT */}

        <View style={s.flex}>
          {/* TOP HEADER */}

          <View
            testID="workspace-header-main"
            style={[
              s.topbar,
              compact && s.topbarCompact,
            ]}
          >
            {webNavigation && !desktop && <Pressable accessibilityRole="button" accessibilityLabel="Open navigation" onPress={() => setNavigationOpen(true)} style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 9, backgroundColor: '#EAF0FF' }}><AppIcon name="menu" size={20} color={colors.primary} /><Text style={s.body}>Menu</Text></Pressable>}
            {!desktop && <BrandLogo size={compact ? 28 : 32} />}
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
                    fontSize: 12,
                  },
                  compact && {
                    fontSize: 12,
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
                    paddingTop: 16,
                  }
                : desktop
                  ? {
                      padding: 24,
                    }
                  : tablet
                  ? {
                      padding: 20,
                      paddingTop: 16,
                    }
                  : {
                      padding: 16,
                      paddingTop: 16,
                    },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {/* PAGE HEADERS */}
            {page === 'tasks' && !isTaskDetail && (
              <AdminPageHeading title={title}
                onBack={() => go('home')}
                style={{ marginBottom: 16 }} />
            )}

            {/* PROFILE LOADING */}
            {assignedProfiles.length > 1 && !(Platform.OS === 'web' && page === 'home') && <View style={[s.card, { gap: 10, marginBottom: 14 }]}>
              <Text style={s.cardTitle}>Choose your work assignment</Text>
              <Text style={s.small}>Attendance, leave and profile details use this assignment.</Text>
              {assignedProfiles.map(profile => <Pressable key={profile.id} accessibilityRole="button" accessibilityLabel={`Work assignment: ${profile.company.name}, ${profile.branch.name}`} accessibilityState={{ selected: selectedProfileId === profile.id }} disabled={!!dialog || attendanceSaving || leaveSaving} onPress={() => setSelectedProfileId(profile.id)} style={[s.secondary, selectedProfileId === profile.id && { backgroundColor: '#EAF0FF' }]}><Text style={s.body}>{profile.company.name} · {profile.branch.name}</Text></Pressable>)}
            </View>}

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
              <View><Text
                accessibilityRole="alert"
                style={s.error}
              >
                {profileError}
              </Text>
              <Button label="Retry employee details" onPress={refreshProfile} /></View>
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


              </>
            )}
          </ScrollView>

          {/* MOBILE / TABLET NAVIGATION */}

          {!webNavigation && (
            <View
              accessibilityRole="tablist"
              style={[s.bottomNav, keyboardVisible && { display: 'none' }]}
            >
              {renderNavigation(false)}
            </View>
          )}
        </View>
      </BlurTargetView>

      {/* EXISTING EMPLOYEE DIALOGS */}

      <EmployeeDialogs />
      <WorkspaceNavigationDrawer {...navigationProps} open={navigationOpen && webNavigation && !desktop} onClose={() => setNavigationOpen(false)} onNavigate={() => setNavigationOpen(false)} />
    </SafeAreaView>
  );
}

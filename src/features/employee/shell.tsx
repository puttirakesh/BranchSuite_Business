import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { employee, colors, navigation } from './data';
import { Button, WorkspaceIcon } from './components';
import { s } from './styles';
import { Slot } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useEmployeeWorkspace } from './workspace';
import { EmployeeDialogs } from './dialogs';
import { BlurTargetView } from 'expo-blur';

export function EmployeeShell() {
  const { compact, desktop, page, signedOut, setSignedOut, loaded, message, storageError, setDialog, setQuery, today, scroll, blurTarget, go } = useEmployeeWorkspace();
  const title = {
    home: "My work",
    attendance: "My attendance",
    tasks: "My tasks",
    payroll: "My payroll",
    leave: "Leave & requests",
    profile: "My profile",
    documents: "My documents",
    advances: "Salary advances",
    help: "Help",
  }[page];
  const subtitles = {
    home: `${new Date(`${today}T12:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} · ${employee.branch}`,
    attendance: "Your shifts and leave requests.",
    tasks: "Only work assigned to you. Add progress and completion notes.",
    payroll: "Published payslips for your employee account.",
    leave: "Apply for leave and track your requests.",
    profile: "Your details and self-service options.",
    documents: "Sample documents available on this device.",
    advances: "Request and track salary advances.",
    help: "Using your employee workspace.",
  };
  const activeNavPage = ["documents", "advances", "help"].includes(page) ? "profile" : page;
  const nav = (sidebar: boolean) =>
    navigation.filter((item) => sidebar || item.page !== "leave").map((item) => (
      <Pressable
        key={item.page}
        accessibilityRole="tab"
        accessibilityState={{ selected: activeNavPage === item.page }}
        onPress={() => go(item.page)}
        style={[
          sidebar ? s.sideItem : s.navItem,
          activeNavPage === item.page && (sidebar ? s.sideActive : s.navActive),
        ]}
      >
        <WorkspaceIcon symbol={item.symbol} color={activeNavPage === item.page ? colors.primary : colors.muted} size={sidebar ? 22 : 21} />
        <Text
          style={[
            sidebar ? s.sideLabel : s.navLabel,
            activeNavPage === item.page && { color: colors.primary, fontWeight: "700" },
          ]}
        >
          {item.label}
        </Text>
      </Pressable>
    ));
  if (signedOut) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={[s.content, { flex: 1, justifyContent: "center", gap: 16, maxWidth: 480, width: "100%", alignSelf: "center" }]}>
          <Text style={s.title}>Signed out</Text>
          <Text style={s.body}>Your sample attendance, payslips and assigned tasks are saved on this device.</Text>
          <Button label="Open sample workspace" onPress={() => { go("home"); setSignedOut(false); }} />
        </View>
      </SafeAreaView>
    );
  }
  return (
    <SafeAreaView style={s.safe} edges={["top", "bottom"]}>
      <BlurTargetView ref={blurTarget} style={s.shell}>
        {desktop && (
          <View style={s.sidebar}>
            <View style={[s.row, { marginBottom: 35 }]}>
              <View style={s.brandIcon}>
                <WorkspaceIcon symbol="♙" color="white" />
              </View>
              <View>
                <Text style={s.brand}>BranchSuite</Text>
                <Text style={s.small}>Employee</Text>
              </View>
            </View>
            <Text style={s.caption}>MY WORKSPACE</Text>
            {nav(true)}
            <View style={s.sideFooter}>
              <View style={s.row}>
                <View style={s.avatar}>
                  <Text style={s.avatarText}>AR</Text>
                </View>
                <View>
                  <Text style={s.cardTitle}>{employee.name}</Text>
                  <Text style={s.small}>Employee</Text>
                </View>
              </View>
              <Text style={s.localHint}>● Sample data · offline</Text>
            </View>
          </View>
        )}
        <View style={s.flex}>
          <View style={[s.topbar, compact && s.topbarCompact]}>
            <View style={[s.flex, compact && s.topbarMeta]}>
              <Text style={[s.cardTitle, compact && { fontSize: 14 }]}>
                {employee.company}
              </Text>
              <Text style={[s.small, { fontSize: 11 }, compact && { fontSize: 10 }]}>
                {employee.branch} · Employee workspace
              </Text>
            </View>
            <View style={s.topbarActions}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Find a module"
                onPress={() => {
                  setQuery("");
                  setDialog("search");
                }}
                style={s.searchButton}
              >
                <WorkspaceIcon symbol="⌕" color={colors.ink} size={22} />
              </Pressable>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="My profile"
                onPress={() => go("profile")}
                style={s.avatar}
              >
                <Text style={s.avatarText}>AR</Text>
              </Pressable>
            </View>
          </View>
          <ScrollView
            ref={scroll}
            contentContainerStyle={[
              s.content,
              { maxWidth: 1240, width: "100%", alignSelf: "center" },
              compact ? { paddingHorizontal: 16, paddingTop: 20 } : desktop ? { padding: 32 } : { padding: 24 },
            ]}
            keyboardShouldPersistTaps="handled"
          >
            {["advances", "help"].includes(page) && (
              <Button label="Back to profile" secondary onPress={() => go("profile")} />
            )}
            {page === "documents" ? (
              <View style={[s.row, { alignItems: "flex-start", marginBottom: 20 }]}>
                <Pressable accessibilityRole="button" accessibilityLabel="Back to profile" onPress={() => go("profile")} style={s.documentBack}>
                  <Text style={s.cardTitle}>‹</Text>
                </Pressable>
                <View style={s.flex}>
                  <Text style={[s.caption, { marginBottom: 6 }]}>5 GEN WORKSPACE</Text>
                  <Text accessibilityRole="header" style={s.title}>{title}</Text>
                  <Text style={[s.subtitle, { marginBottom: 0 }]}>{subtitles[page]}</Text>
                </View>
              </View>
            ) : page === 'leave' ? null : <>
            <Text accessibilityRole="header" style={s.title}>
              {title}
            </Text>
            <Text style={s.subtitle}>{subtitles[page]}</Text>
            </>}
            {storageError && (
              <Text accessibilityRole="alert" style={s.error}>
                Device storage is unavailable or could not be read. Changes may
                only last for this session.
              </Text>
            )}
            {!loaded ? (
              <ActivityIndicator
                color={colors.primary}
                style={{ margin: 40 }}
              />
            ) : (
              <>
                <Slot />
                <Text style={[s.footer, page === 'leave' && s.leaveFooter]}>Offline sample workspace{' \u00B7 '}{page === 'leave' ? `${new Date(`${today}T12:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} \u00B7 ` : ''}v2.3</Text>
              </>
            )}
          </ScrollView>
          {!desktop && (
            <View accessibilityRole="tablist" style={s.bottomNav}>
              {nav(false)}
            </View>
          )}
        </View>
      </BlurTargetView>
      {!!message && (
        <View
          accessibilityRole="alert"
          style={[s.toast, { bottom: desktop ? 24 : 92 }]}
        >
          <Text style={s.toastText}>{message}</Text>
        </View>
      )}
      <EmployeeDialogs />
    </SafeAreaView>
  );
}

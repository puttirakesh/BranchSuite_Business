import { useState, type PropsWithChildren } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { router, usePathname } from "expo-router";
import { useSession } from "../store/session";
import { Button, Sheet, styles } from "./ui";
import { colors } from "../constants/colors";
import { entityKinds } from "../types";
import { useIsMutating } from "@tanstack/react-query";

export function BusinessShell({ children }: PropsWithChildren) {
  const { session, scope, membership, selectBranch, can, logout, isDemo } =
    useSession();
  const [picker, setPicker] = useState(false);
  const [logoutBusy, setLogoutBusy] = useState(false);
  const path = usePathname();
  const saving = useIsMutating() > 0;
  const branch = membership?.branches.find((b) => b.id === scope?.branchId);
  const links = [
    { label: "Overview", path: "/", allowed: true },
    ...entityKinds.map((kind) => ({
      label: kind[0].toUpperCase() + kind.slice(1),
      path: `/crm/${kind}`,
      allowed: can(`${kind}:read`),
    })),
  ];
  return (
    <View style={styles.page}>
      <View
        style={{
          backgroundColor: "#FFF",
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
          paddingHorizontal: 20,
          paddingVertical: 16,
          gap: 14,
        }}
      >
        <View style={[styles.row, { flexWrap: "wrap" }]}>
          <View style={{ flex: 1, minWidth: 160 }}>
            <Text
              style={{
                fontWeight: "800",
                color: colors.business,
                fontSize: 21,
              }}
            >
              BranchSuite<Text style={{ color: colors.text }}> Business</Text>
            </Text>
            <Text style={styles.muted}>{session?.user.name}</Text>
          </View>
          <Button
            title={
              branch
                ? `${membership?.companyName} · ${branch.name} ▾`
                : "Select branch"
            }
            disabled={saving || logoutBusy}
            onPress={() => setPicker(true)}
            variant="secondary"
          />
          <Button
            title="Sign out"
            disabled={saving}
            busy={logoutBusy}
            onPress={() => {
              setLogoutBusy(true);
              void logout().finally(() => setLogoutBusy(false));
            }}
            variant="secondary"
          />
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 6 }}
        >
          {links
            .filter((l) => l.allowed)
            .map((link) => {
              const active =
                link.path === "/" ? path === "/" : path.startsWith(link.path);
              return (
                <Pressable
                  key={link.path}
                  accessibilityRole="link"
                  accessibilityState={{ selected: active }}
                  onPress={() => router.push(link.path as "/")}
                  style={{
                    paddingHorizontal: 18,
                    paddingVertical: 12,
                    borderRadius: 10,
                    backgroundColor: active ? colors.business : "#FFF",
                  }}
                >
                  <Text
                    style={{
                      fontWeight: "600",
                      color: active ? "#FFF" : colors.secondaryText,
                    }}
                  >
                    {link.label}
                  </Text>
                </Pressable>
              );
            })}
        </ScrollView>
      </View>
      {isDemo && (
        <Text
          style={{
            padding: 12,
            textAlign: "center",
            backgroundColor: "#DDF7F0",
            color: "#166451",
          }}
        >
          Local demo preview · Sample CRM records only · Changes reset when the
          app reloads
        </Text>
      )}
      <View
        key={`${scope?.membershipId}:${scope?.branchId}`}
        style={{ flex: 1 }}
      >
        {children}
      </View>
      <Sheet
        visible={picker}
        title="Choose your workspace"
        onClose={() => setPicker(false)}
      >
        <Text style={styles.muted}>
          Changing branch opens its overview and discards unsaved form changes.
        </Text>
        {session?.memberships.map((m) => (
          <View key={m.id} style={{ gap: 10 }}>
            <Text style={styles.heading}>{m.companyName}</Text>
            <Text style={styles.muted}>{m.role.replaceAll("_", " ")}</Text>
            {m.branches.length === 0 && (
              <Text style={styles.muted}>
                No branches assigned. Contact your administrator.
              </Text>
            )}
            {m.branches.map((b) => (
              <Button
                key={b.id}
                title={`${b.name}${scope?.membershipId === m.id && scope.branchId === b.id ? " ✓" : ""}`}
                variant="secondary"
                onPress={() => {
                  selectBranch(m.id, b.id);
                  setPicker(false);
                  router.replace("/");
                }}
              />
            ))}
          </View>
        ))}
        {!session?.memberships.length && (
          <Text style={styles.muted}>
            You have no company memberships. Ask your administrator for access.
          </Text>
        )}
      </Sheet>
    </View>
  );
}

import React from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { AppText, Avatar, Button, Card, Grid, ModuleCard, PageHeader, Screen } from '../../../shared/components';
import { useAuth } from '../../../core/auth/AuthContext';
import { can, roleLabel } from '../../../core/permissions/roles';

/** APK `platform-more`: the phone hub for modules that are not in the bottom bar. */
export function MoreScreen() {
  const { user, signOut } = useAuth();
  const role = user?.role;
  const go = (href: string) => router.push(href as never);
  const modules = [
    can(role, 'marketing.manage') && <ModuleCard key="m" label="Sales prospects" description="Demos, trial enquiries and follow-up stages." icon="leads" tone="blue" onPress={() => go('/marketing')} />,
    can(role, 'offers.manage') && <ModuleCard key="o" label="Offers & campaigns" description="Coupon settings and acquisition offers." icon="star" tone="lavender" onPress={() => go('/offers')} />,
    can(role, 'support.view') && <ModuleCard key="s" label="Customer support" description="Replies, internal notes and ticket states." icon="support" tone="mint" onPress={() => go('/support')} />,
    can(role, 'settings.manage') && <ModuleCard key="st" label="Platform settings" description="Brand, contact and trial controls." icon="settings" tone="blue" onPress={() => go('/settings')} />,
    can(role, 'audit.view') && <ModuleCard key="a" label="Audit history" description="A record of platform changes." icon="doc" tone="lavender" onPress={() => go('/audit')} />,
  ].filter(Boolean);
  return (
    <Screen>
      <PageHeader title="Platform modules" subtitle="A clear place for the rest of your admin work." />
      <Grid columns={{ base: 2, sidebar: 3 }} gap={14} style={{ marginBottom: 22 }}>{modules}</Grid>
      <Card style={{ marginBottom: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <Avatar name={user?.name ?? ''} size={44} />
          <View style={{ flex: 1 }}>
            <AppText variant="h3">{user?.name}</AppText>
            <AppText variant="small">{user?.email} · {role ? roleLabel[role] : ''}</AppText>
          </View>
        </View>
      </Card>
      <Button label="Sign out" variant="soft" icon="logout" full onPress={async () => { await signOut(); router.replace('/login'); }} />
    </Screen>
  );
}

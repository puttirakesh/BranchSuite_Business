import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppIcon } from './AppIcon';
import { Dropdown } from './Dropdown';
import { selectAdminBranch, useAdminScope } from '../core/admin/scope';
import { useAvailableBranches } from '../core/admin/available-branches';
import { toast } from './toast-store';
import { webWorkspaceStyles, webWorkspaceTheme } from './webWorkspaceStyles';

export function WorkspaceSectionBranch({ style }: { style?: StyleProp<ViewStyle> } = {}) {
  const scope = useAdminScope();
  const { branches, loading, error, refresh } = useAvailableBranches();
  return <SectionBranchSelect style={style} value={scope?.branchId ?? ''} options={[{ value: '', label: 'All branches' }, ...branches.map(branch => ({ value: branch.id, label: branch.name }))]} disabled={loading || !scope} error={error} onRetry={refresh} onChange={value => { void selectAdminBranch(value || null).catch(cause => toast.error(cause instanceof Error ? cause.message : 'Could not change branch.')); }} />;
}

/** Compact section filter; options are supplied by the page's scoped directory. */
export function SectionBranchSelect({ label = 'Branch', value, options, onChange, disabled = false, error, onRetry, style }: {
  label?: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
  disabled?: boolean;
  error?: string;
  onRetry?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  if (error) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel="Retry loading branches" accessibilityHint={error} onPress={onRetry} style={[s.retry, style]}>
        <View style={s.copy}><Text style={s.label}>Branch</Text><Text numberOfLines={1} style={s.error}>Could not load. Tap to retry</Text></View>
        <AppIcon name="refresh-cw" size={16} color="#B94D61" />
      </Pressable>
    );
  }
  return <Dropdown label={label} valueOnly placeholder="Select a branch" value={value} options={options} onChange={onChange} disabled={disabled} style={[s.dropdown, style]} />;
}

const web = Platform.OS === 'web';
const s = webWorkspaceStyles(StyleSheet.create({
  dropdown: { width: 180 },
  retry: { width: 180, minHeight: 54, borderWidth: 1, borderColor: '#f0c4cd', borderRadius: web ? webWorkspaceTheme.radiusControl : 8, backgroundColor: '#fff', paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 8 },
  copy: { flex: 1, minWidth: 0 }, label: { fontSize: 10, lineHeight: 14, color: '#607591' }, error: { fontSize: 12, lineHeight: 18, color: '#B94D61' },
}));

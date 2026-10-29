import { useToastState } from '../../../src/ui/useToastState';
import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useWorkspaceFocusEffect as useFocusEffect } from '../../../src/core/admin/useWorkspaceFocusEffect';
import * as FileSystem from 'expo-file-system/legacy';
import { AdminPageHeading } from '../../../src/ui/AdminPageHeading';
import { AdminBottomNavigation } from '../../../src/ui/AdminBottomNavigation';
import { useAdminLayout } from '../../../src/ui/useAdminLayout';
import { employeeDocumentsApi, type EmployeeDocumentDto } from '../../../src/core/admin/workspace-records.api';
import { getAdminScope } from '../../../src/core/admin/scope';

export default function MyDocumentsPage() {
  const router = useRouter();
  const { styles } = useAdminLayout(baseStyles, 'detail');
  const [items, setItems] = useState<EmployeeDocumentDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useToastState('', 'error');
  const [downloading, setDownloading] = useState('');
  const [attempt, setAttempt] = useState(0);
  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true); setError('');
    employeeDocumentsApi.mine().then(rows => { if (active) setItems(rows); })
      .catch(cause => { if (active) setError(cause instanceof Error ? cause.message : 'Could not load your documents.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [attempt]));
  const download = async (item: EmployeeDocumentDto) => {
    setDownloading(item.id); setError('');
    try {
      const file = await employeeDocumentsApi.file(item.id);
      if (Platform.OS === 'web') {
        const link = document.createElement('a');
        link.href = `data:${file.mimeType};base64,${file.fileDataBase64}`;
        link.download = file.fileName;
        link.click();
      } else {
        const path = `${FileSystem.cacheDirectory}${file.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
        await FileSystem.writeAsStringAsync(path, file.fileDataBase64, { encoding: FileSystem.EncodingType.Base64 });
        const Sharing = await import('expo-sharing');
        await Sharing.shareAsync(path, { mimeType: file.mimeType, dialogTitle: file.fileName });
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not download this file.'); }
    finally { setDownloading(''); }
  };
  return <SafeAreaView edges={['left', 'right']} style={styles.safe}>
    <ScrollView contentContainerStyle={styles.content}>
      <AdminPageHeading title="My documents" onBack={() => router.canGoBack() ? router.back() : router.replace('/admin/more')} onRefresh={() => setAttempt(value => value + 1)} refreshing={loading} />
      {!!error && <Text accessibilityRole="alert" style={styles.error}>{error}</Text>}
      {loading ? <ActivityIndicator accessibilityLabel="Loading documents" /> : items.length ? items.map(item => <View key={item.id} style={styles.card}>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.meta}>{item.kind.toLowerCase()} · {new Date(item.createdAt).toLocaleDateString()}</Text>
        {item.content ? <Text selectable style={styles.body}>{item.content}</Text> : null}
        {item.fileName ? <Pressable accessibilityRole="button" disabled={downloading === item.id} onPress={() => void download(item)} style={styles.button}><Text style={styles.buttonText}>{downloading === item.id ? 'Preparing file…' : `Download ${item.fileName}`}</Text></Pressable> : null}
      </View>) : <View style={styles.card}><Text style={styles.title}>No documents yet</Text><Text style={styles.body}>Documents issued by your HR team will appear here.</Text><Pressable accessibilityRole="button" onPress={() => setAttempt(value => value + 1)} style={styles.button}><Text style={styles.buttonText}>Refresh</Text></Pressable></View>}
    </ScrollView>
    <AdminBottomNavigation />
  </SafeAreaView>;
}

const baseStyles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#f6f8fd' }, content: { width: '100%', maxWidth: 960, alignSelf: 'center', padding: 18, paddingBottom: 32, gap: 14 }, card: { padding: 18, gap: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: '#dce5f3', borderRadius: 16 }, title: { fontSize: 17, fontWeight: '700', color: '#20334f' }, meta: { fontSize: 12, color: '#71829c' }, body: { fontSize: 14, lineHeight: 21, color: '#405573' }, button: { alignSelf: 'flex-start', paddingVertical: 10, paddingHorizontal: 14, borderRadius: 9, backgroundColor: '#eaf0ff' }, buttonText: { fontSize: 13, fontWeight: '700', color: '#345cf2' }, error: { color: '#b3261e', fontSize: 13 } });

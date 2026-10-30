import { Text, View } from 'react-native';
export default function Header({ title = 'BranchSuite Admin', subtitle }: { title?: string; subtitle?: string }) { return <View style={{ padding: 20, gap: 6 }}><Text style={{ fontSize: 24, fontWeight: '700', color: '#6947B8' }}>{title}</Text>{subtitle && <Text>{subtitle}</Text>}</View>; }

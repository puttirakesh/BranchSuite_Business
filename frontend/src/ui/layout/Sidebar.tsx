import { View } from 'react-native';
import { router, type Href } from 'expo-router';
import { navigation } from '../../core/config/navigation';
import { hasPermission } from '../../core/permissions/permissions';
import { useAuth } from '../../core/auth/AuthContext';
import AppButton from '../../shared/components/AppButton';
export default function Sidebar() { const { account } = useAuth(); return <View style={{ gap: 8, padding: 16 }}>{navigation.filter(n=>hasPermission(account,n.module)).map(n=><AppButton key={n.module} title={n.label} onPress={()=>router.push(n.route as Href)} />)}</View>; }

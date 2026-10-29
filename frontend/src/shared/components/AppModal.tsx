import { Modal, ScrollView } from 'react-native';
import AppCard from './AppCard';
import AppButton from './AppButton';
export default function AppModal({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) { return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: 20, backgroundColor: '#17263F66' }}><AppCard>{children}<AppButton title="Close" onPress={onClose} /></AppCard></ScrollView></Modal>; }

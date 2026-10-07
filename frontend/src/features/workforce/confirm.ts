import { Alert } from 'react-native';
export function confirmAction(title: string, message: string, action: string, onConfirm: () => void) {
  Alert.alert(title, message, [{ text: 'Cancel', style: 'cancel' }, { text: action, onPress: onConfirm }]);
}

import { Text, View } from 'react-native';
import AppButton from './AppButton';
export default function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) { return <View style={{ padding: 24, gap: 16 }}><Text accessibilityRole="alert">{message}</Text>{onRetry && <AppButton title="Retry" onPress={onRetry} />}</View>; }

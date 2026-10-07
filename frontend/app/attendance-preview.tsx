import { useLocalSearchParams } from 'expo-router';
import AttendanceLeaveScreen from '../src/features/workforce/AttendanceLeaveScreen';

export default function AttendancePreview() {
  const { tab } = useLocalSearchParams<{ tab?: string }>();
  return <AttendanceLeaveScreen key={tab || 'attendance'} initialTab={tab === 'leave' ? 'leave' : 'attendance'} />;
}

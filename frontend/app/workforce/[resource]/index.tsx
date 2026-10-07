import { Stack, useLocalSearchParams } from 'expo-router';
import ListScreen from '../../../src/features/workforce/ListScreen';
import { resourceParam } from '../../../src/features/workforce/route';
import { State } from '../../../src/features/workforce/ui';
export default function RecordsRoute() {
  const params = useLocalSearchParams<{ resource: string }>();
  const resource = resourceParam(params.resource);
  return resource ? <><Stack.Screen options={{ headerShown: !['employees', 'attendance', 'leave'].includes(resource) }} /><ListScreen resource={resource} /></> : <State title="Module not found" />;
}

import { Stack, useLocalSearchParams } from 'expo-router';
import FormScreen from '../../../src/features/workforce/FormScreen';
import { resourceParam } from '../../../src/features/workforce/route';
import { State } from '../../../src/features/workforce/ui';
export default function NewRoute() {
  const params = useLocalSearchParams<{ resource: string }>();
  const resource = resourceParam(params.resource);
  return resource ? <><Stack.Screen options={{ headerShown: resource !== 'employees' && resource !== 'tasks' }} /><FormScreen resource={resource} /></> : <State title="Module not found" />;
}

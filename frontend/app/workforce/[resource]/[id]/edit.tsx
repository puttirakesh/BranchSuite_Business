import { Stack, useLocalSearchParams } from 'expo-router';
import FormScreen from '../../../../src/features/workforce/FormScreen';
import { idParam, resourceParam } from '../../../../src/features/workforce/route';
import { State } from '../../../../src/features/workforce/ui';
export default function EditRoute() {
  const params = useLocalSearchParams<{ resource: string; id: string }>();
  const resource = resourceParam(params.resource), id = idParam(params.id);
  return resource && id ? <><Stack.Screen options={{ headerShown: resource !== 'employees' }} /><FormScreen resource={resource} id={id} /></> : <State title="Record not found" />;
}

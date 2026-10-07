import { useLocalSearchParams } from 'expo-router';
import DetailScreen from '../../../../src/features/workforce/DetailScreen';
import { idParam, resourceParam } from '../../../../src/features/workforce/route';
import { State } from '../../../../src/features/workforce/ui';
export default function DetailRoute() {
  const params = useLocalSearchParams<{ resource: string; id: string }>();
  const resource = resourceParam(params.resource), id = idParam(params.id);
  return resource && id ? <DetailScreen resource={resource} id={id} /> : <State title="Record not found" />;
}

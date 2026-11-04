import { useLocalSearchParams } from 'expo-router';

/** Reads the `[id]` segment as a single string. */
export function useRouteId(): string {
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  return Array.isArray(id) ? (id[0] ?? '') : (id ?? '');
}

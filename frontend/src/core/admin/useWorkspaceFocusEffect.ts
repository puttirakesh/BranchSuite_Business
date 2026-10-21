import { useCallback, useEffect, useState, type EffectCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { getAdminSelectionVersion, subscribeAdminSelection } from './scope';

/** Reload focused admin data whenever the shared company or branch changes. */
export function useWorkspaceFocusEffect(effect: EffectCallback) {
  const [revision, setRevision] = useState(getAdminSelectionVersion);
  useEffect(() => {
    const refresh = () => setRevision(getAdminSelectionVersion());
    const unsubscribe = subscribeAdminSelection(refresh);
    refresh();
    return unsubscribe;
  }, []);
  useFocusEffect(useCallback(() => effect(), [effect, revision]));
}

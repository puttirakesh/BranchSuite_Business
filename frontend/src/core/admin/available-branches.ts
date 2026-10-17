import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { branchesApi, type AvailableBranchDto } from './api';
import { getAdminScope, subscribeAdminSelection } from './scope';
import { apiErrorMessage } from './http';

export type { AvailableBranchDto } from './api';

/** Branches come from the directory, including locations with no feature records. */
export async function getAvailableBranches(companyId?: string): Promise<AvailableBranchDto[]> {
  const company = companyId ?? (await getAdminScope()).companyId;
  const branches = await branchesApi.available(company);
  return branches
    .filter(branch => branch.companyId === company && branch.status === 'ACTIVE')
    .sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
}

export function useAvailableBranches(companyId?: string) {
  const [branches, setBranches] = useState<AvailableBranchDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const request = useRef(0);
  const refresh = useCallback(() => setRevision(value => value + 1), []);

  useEffect(() => subscribeAdminSelection(refresh), [refresh]);
  useFocusEffect(useCallback(() => {
    const current = ++request.current;
    setBranches([]);
    setLoading(true);
    setError('');
    getAvailableBranches(companyId)
      .then(rows => { if (current === request.current) setBranches(rows); })
      .catch(cause => {
        if (current === request.current) setError(apiErrorMessage(cause, 'Could not load available branches.'));
      })
      .finally(() => { if (current === request.current) setLoading(false); });
    return () => { request.current++; };
  }, [companyId, revision]));

  return { branches, loading, error, refresh };
}

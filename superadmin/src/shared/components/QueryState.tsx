import React from 'react';
import { ErrorState } from './ErrorState';
import { LoadingList } from './LoadingState';

/** Standard loading / error / empty switch for a query result. */
export function QueryState<T>({ query, isEmpty, empty, loading, children }: {
  query: { data: T | undefined; isPending: boolean; error: unknown; refetch: () => unknown };
  isEmpty?: (data: T) => boolean;
  empty?: React.ReactNode;
  loading?: React.ReactNode;
  children: (data: T) => React.ReactNode;
}) {
  if (query.isPending) return <>{loading ?? <LoadingList />}</>;
  if (query.error || query.data === undefined) return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  if (isEmpty?.(query.data) && empty) return <>{empty}</>;
  return <>{children(query.data)}</>;
}

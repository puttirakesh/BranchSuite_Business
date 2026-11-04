import { useState } from 'react';
import { errorMessage, isAppError } from '../../core/api/api-error';

/** Tracks a form-level error from a mutation, including which endpoint is still pending. */
export function useFormError() {
  const [message, setMessage] = useState<string | null>(null);
  return {
    message,
    clear: () => setMessage(null),
    set: (error: unknown) => {
      const endpoint = isAppError(error) && error.kind === 'pending_integration' ? error.detail?.endpoint : undefined;
      setMessage(errorMessage(error) + (endpoint ? ' Needs: ' + endpoint : ''));
    },
  };
}

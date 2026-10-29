type ResetListener = () => void;

const listeners = new Set<ResetListener>();

export function subscribeSubmittedInputReset(listener: ResetListener) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

/** Clear interacted text fields after a successful form submission. */
export function clearSubmittedInputs() {
  listeners.forEach(listener => listener());
}

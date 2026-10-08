export function confirmAction(title: string, message: string, _action: string, onConfirm: () => void) {
  if (typeof window !== 'undefined' && window.confirm(`${title}\n\n${message}`)) onConfirm();
}

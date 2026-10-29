export function firstName(name?: string | null): string {
  return name?.trim().split(/\s+/)[0] || 'User';
}

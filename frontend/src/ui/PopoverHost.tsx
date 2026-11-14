import React from 'react';

// Web dropdowns already portal to document.body; no extra layout wrapper is needed.
export function PopoverHost({ children }: { children: React.ReactNode; backHandlerRef?: React.RefObject<(() => boolean) | null> }) { return <>{children}</>; }
export function PopoverPortal(_props: { children: React.ReactNode; onDismiss: () => void }) { return null; }

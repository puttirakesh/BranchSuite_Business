import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { OfferEditor } from '../../features/offers/components/OfferEditor';
import { CampaignEditor } from '../../features/offers/components/CampaignEditor';
import { useAuth } from '../../core/auth/AuthContext';
import { can } from '../../core/permissions/roles';

type Action = 'offer' | 'campaign' | null;
const QuickActionContext = createContext<(action: Exclude<Action, null>) => void>(() => {});

/** Hosts editors that the dashboard, module search and Offers screen can all open. */
export function QuickActionProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Action>(null);
  const { user } = useAuth();
  const authorized = can(user?.role, 'offers.manage');
  const openAction = useCallback((action: Exclude<Action, null>) => {
    if (authorized) setOpen(action);
  }, [authorized]);

  useEffect(() => {
    if (!authorized) setOpen(null);
  }, [authorized]);

  return (
    <QuickActionContext.Provider value={openAction}>
      {children}
      {authorized && open === 'offer' ? <OfferEditor visible offer={null} onClose={() => setOpen(null)} /> : null}
      {authorized && open === 'campaign' ? <CampaignEditor visible campaign={null} onClose={() => setOpen(null)} /> : null}
    </QuickActionContext.Provider>
  );
}

export const useQuickAction = () => useContext(QuickActionContext);

import React, { createContext, useContext, useState } from 'react';
import { OfferEditor } from '../../features/offers/components/OfferEditor';
import { CampaignEditor } from '../../features/offers/components/CampaignEditor';

type Action = 'offer' | 'campaign' | null;
const QuickActionContext = createContext<(action: Exclude<Action, null>) => void>(() => {});

/** Hosts editors that the dashboard, module search and Offers screen can all open. */
export function QuickActionProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState<Action>(null);
  return (
    <QuickActionContext.Provider value={setOpen}>
      {children}
      <OfferEditor visible={open === 'offer'} offer={null} onClose={() => setOpen(null)} />
      <CampaignEditor visible={open === 'campaign'} campaign={null} onClose={() => setOpen(null)} />
    </QuickActionContext.Provider>
  );
}

export const useQuickAction = () => useContext(QuickActionContext);

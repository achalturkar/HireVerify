'use client';

import { createContext, useContext, type ReactNode } from 'react';

export type ClientPortalBrand = {
  name: string;
  logoUrl: string | null;
  clientCode?: string | null;
  industry?: string | null;
  supportEmail?: string | null;
  supportPhone?: string | null;
  website?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
};

const ClientPortalBrandContext = createContext<ClientPortalBrand | null>(null);

export function ClientPortalBrandProvider({
  client,
  children,
}: {
  client: ClientPortalBrand | null;
  children: ReactNode;
}) {
  return <ClientPortalBrandContext.Provider value={client}>{children}</ClientPortalBrandContext.Provider>;
}

export function useClientPortalBrand() {
  return useContext(ClientPortalBrandContext);
}

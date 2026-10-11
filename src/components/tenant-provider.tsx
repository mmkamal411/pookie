"use client";

import { createContext, useContext } from "react";
import type { TenantMembership } from "@/lib/tenant/types";

interface TenantContextValue {
  memberships: TenantMembership[];
  activeChildId: string | null;
  activeChild: TenantMembership["child"] | null;
}

const TenantContext = createContext<TenantContextValue>({
  memberships: [],
  activeChildId: null,
  activeChild: null,
});

export function TenantProvider({
  memberships,
  activeChildId,
  children,
}: {
  memberships: TenantMembership[];
  activeChildId: string | null;
  children: React.ReactNode;
}) {
  const activeChild =
    memberships.find((m) => m.child_id === activeChildId)?.child ?? null;
  return (
    <TenantContext.Provider value={{ memberships, activeChildId, activeChild }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}

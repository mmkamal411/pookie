// Home-grove + Safety + Marketplace applet content.
// W21 Mail, W20 Shopping List, W11 Spending, W7 Money & Documents,
// W24 Credit, W14 Co-parenting, W3 Insurance, W15 Screen Time,
// W12 Babysitters, W6 Driving School, W26 Weather.
// Household components are account-scoped and need no props; tenant ones
// get childId/childName from the layout's tenant provider.

"use client";

import { MailBoard } from "@/components/home-money/mail-board";
import { ShoppingBoard } from "@/components/shopping/shopping-board";
import { LinkedShipsPanel } from "@/components/shopping/linked-ships";
import { SpendingBoard } from "@/components/home-money/spending-board";
import { VaultBoard } from "@/components/home-money/vault-board";
import { CreditBoard } from "@/components/home-money/credit-board";
import { CoparentingBoard } from "@/components/home-money/coparenting-board";
import { InsuranceHub } from "@/components/insurance/insurance-hub";
import { ScreenTimeCoSet } from "@/components/safety/ScreenTimeCoSet";
import type { SafetyActions } from "@/components/safety/types";
import { MarketplaceHub } from "@/components/marketplace/marketplace-hub";
import { WeatherHub } from "@/components/weather/weather-hub";
import {
  getScreenTimeState,
  proposeScreenTime,
  reviewScreenTime,
  appealScreenTime,
  respondToAppeal,
  listScreenTimeAppeals,
} from "@/lib/safety/actions";
import {
  AppletGate,
  useAppletTenant,
  useSquad5Ctx,
} from "@/components/applet-views-shared";

/** W21 Mail. */
export function MailApplet() {
  return <MailBoard />;
}

/** W20 Shopping List. */
export function ShoppingApplet() {
  return (
    <div className="space-y-6">
      <ShoppingBoard />
      <LinkedShipsPanel />
    </div>
  );
}

/** W11 Spending. */
export function SpendingApplet() {
  return <SpendingBoard />;
}

/** W7 Money & Documents (vault). */
export function VaultApplet() {
  return <VaultBoard />;
}

/** W24 Credit freezes. */
export function CreditApplet() {
  const t = useAppletTenant();
  return <CreditBoard childId={t.childId} childName={t.childName} />;
}

/** W14 Co-parenting. */
export function CoparentingApplet() {
  const t = useAppletTenant();
  return <CoparentingBoard childId={t.childId} childName={t.childName} />;
}

/** W3 Insurance (Safety grove). */
export function InsuranceApplet() {
  return <InsuranceHub />;
}

/** W26 Weather (household, coarse ZIP). */
export function WeatherApplet() {
  return <WeatherHub />;
}

/** W15 Screen Time — same props the page passes, including the six server actions. */
export function ScreenTimeApplet() {
  const t = useAppletTenant();
  return (
    <ScreenTimeCoSet
      childProfileId={t.childId}
      viewerRole={t.role === "child" ? "teen" : "parent"}
      teenName={t.childName}
      parentName="Parent"
      actions={{
        getScreenTimeState,
        proposeScreenTime,
        reviewScreenTime,
        appealScreenTime,
        respondToAppeal,
        listScreenTimeAppeals,
      } as SafetyActions}
    />
  );
}

/** W12 Babysitters + W6 Driving School — the marketplace hub covers both. */
export function MarketplaceApplet() {
  const t = useAppletTenant();
  const { s5, failed, retry } = useSquad5Ctx(t.childSlug);
  return (
    <AppletGate
      label="Marketplace"
      loading={!s5 && !failed}
      failed={failed}
      onRetry={retry}
    >
      {s5 ? (
        <MarketplaceHub childSlug={t.childSlug} childId={s5.childId} childAge={s5.childAge} />
      ) : null}
    </AppletGate>
  );
}

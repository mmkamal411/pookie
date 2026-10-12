// Health-grove applet content (W2 Health, W8 Wellbeing, W13 Meals,
// W22 Activity, W23 Nutrition). Each wrapper resolves the same server-side
// health context the module pages used, then renders the real view
// component — loading shimmer first, plain-English error on failure.

"use client";

import { HealthHub } from "@/components/health/health-hub";
import { WellbeingView } from "@/components/health/wellbeing-view";
import { MealsView } from "@/components/health/meals-view";
import { NutritionView } from "@/components/health/nutrition-view";
import { TeenPrivateNotice } from "@/components/health/ui";
import { ActivityHub } from "@/components/activity/activity-hub";
import {
  AppletGate,
  useAppletTenant,
  useHealthCtx,
} from "@/components/applet-views-shared";

function HealthCtxGate({
  label,
  render,
}: {
  label: string;
  render: (childId: string, ctx: NonNullable<ReturnType<typeof useHealthCtx>["ctx"]>) => React.ReactNode;
}) {
  const t = useAppletTenant();
  const { ctx, failed, retry } = useHealthCtx(t.childId);
  return (
    <AppletGate label={label} loading={!ctx && !failed} failed={failed} onRetry={retry}>
      {ctx ? render(t.childId, ctx) : null}
    </AppletGate>
  );
}

/** W2 Health hub. */
export function HealthApplet() {
  return (
    <HealthCtxGate
      label="Health"
      render={(childId, ctx) => <HealthHub childId={childId} ctx={ctx} />}
    />
  );
}

/**
 * W8 Wellbeing — teen-private. Mirrors the page's gate: parents see the
 * locked notice (never aggregates), steward parents of under-13s pass.
 */
export function WellbeingApplet() {
  return (
    <HealthCtxGate
      label="Wellbeing"
      render={(childId, ctx) => {
        const allowed = ctx.isSubject || (ctx.band === "under13" && ctx.role === "parent");
        if (!allowed) return <TeenPrivateNotice teenName={ctx.displayName} />;
        return <WellbeingView childId={childId} ctx={ctx} />;
      }}
    />
  );
}

/** W13 Meals. */
export function MealsApplet() {
  return (
    <HealthCtxGate
      label="Meals"
      render={(childId, ctx) => <MealsView childId={childId} ctx={ctx} />}
    />
  );
}

/** W23 Nutrition. */
export function NutritionApplet() {
  return (
    <HealthCtxGate
      label="Nutrition"
      render={(childId, ctx) => <NutritionView childId={childId} ctx={ctx} />}
    />
  );
}

/** W22 Activity — child-scoped hub, no server context needed. */
export function ActivityApplet() {
  const t = useAppletTenant();
  return <ActivityHub childId={t.childId} childName={t.childName} />;
}

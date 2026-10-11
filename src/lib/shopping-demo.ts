// Demo data for the W20 shopping list — lets the founder click through the
// full surface without logging in. Only used when NEXT_PUBLIC_DEMO_MODE=1
// and the demo cookie is present; real auth/RLS flow is untouched.
import type {
  PriceReport,
  ShoppingItem,
  ShoppingList,
} from "@/server/services/shopping";

const DEMO_PARENT = "00000000-0000-4000-8000-0000000000d1";
const DEMO_DAWSON = "00000000-0000-4000-8000-0000000000d2";

export interface ShoppingDemoData {
  list: ShoppingList;
  items: ShoppingItem[];
  prices: PriceReport[];
  role: "parent";
  userId: string;
}

function item(over: Partial<ShoppingItem> & { id: string; name: string }): ShoppingItem {
  const base: ShoppingItem = {
    list_id: "demo-list",
    id: over.id,
    name: over.name,
    quantity: 1,
    unit: null,
    note: null,
    status: "needed",
    added_by: DEMO_DAWSON,
    added_by_name: "Dawson",
    claimed_by: null,
    bought_by: null,
    bought_at: null,
    store: null,
    price_paid: null,
    source: "manual",
    source_ref: null,
    created_at: new Date().toISOString(),
  };
  return { ...base, ...over };
}

export function getDemoShoppingData(): ShoppingDemoData {
  return {
    list: {
      id: "demo-list",
      owner_user_id: DEMO_PARENT,
      name: "Family shopping list",
      preferences: {
        preferred_stores: ["Kroger", "Aldi"],
        standing_rules: "we don't do Walmart",
        category_defaults: { dairy: "Aldi", produce: "Kroger" },
      },
      created_at: new Date().toISOString(),
    },
    role: "parent",
    userId: DEMO_PARENT,
    items: [
      item({ id: "demo-i1", name: "milk", quantity: 1, unit: "gal", note: "oat, not dairy", added_by_name: "Dawson" }),
      item({ id: "demo-i2", name: "eggs", quantity: 1, unit: "doz", added_by: DEMO_PARENT, added_by_name: "Dad" }),
      item({
        id: "demo-i3",
        name: "chicken thighs",
        quantity: 2,
        unit: "lb",
        status: "claimed",
        claimed_by: DEMO_PARENT,
        source: "meal-plan",
        source_ref: { meal_plan_id: "demo-week", week: "2026-10-12" },
        added_by_name: "Dawson",
      }),
      item({
        id: "demo-i4",
        name: "paper towels",
        quantity: 1,
        unit: "pk",
        status: "bought",
        bought_by: DEMO_PARENT,
        bought_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
        store: "Kroger",
        price_paid: 8.99,
        added_by: DEMO_PARENT,
        added_by_name: "Dad",
      }),
    ],
    prices: [
      {
        id: "demo-p1",
        list_id: "demo-list",
        item_name: "milk",
        store: "Kroger",
        price: 4.29,
        reported_by: DEMO_PARENT,
        reported_by_name: "Dad",
        reported_at: "2026-10-04",
        receipt_item_id: null,
        created_at: "2026-10-04T12:00:00Z",
      },
      {
        id: "demo-p2",
        list_id: "demo-list",
        item_name: "milk",
        store: "Aldi",
        price: 3.79,
        reported_by: DEMO_PARENT,
        reported_by_name: "Dad",
        reported_at: "2026-10-09",
        receipt_item_id: null,
        created_at: "2026-10-09T12:00:00Z",
      },
      {
        id: "demo-p3",
        list_id: "demo-list",
        item_name: "paper towels",
        store: "Kroger",
        price: 8.99,
        reported_by: DEMO_PARENT,
        reported_by_name: "Dad",
        reported_at: "2026-10-11",
        receipt_item_id: "demo-i4",
        created_at: new Date().toISOString(),
      },
    ],
  };
}

// Background AI — domain event bus.
// Tiny in-process pub/sub (same pattern as the applet bus): emitters never
// import subscribers. Route handlers/services emit; watchers and the layout
// engine subscribe. When the automation host splits into its own worker, this
// gains a Postgres outbox with zero API change for emitters (phase 3).

export type AutomationEventName =
  | "bill.created"
  | "bill.paid"
  | "task.completed"
  | "mail.scanned"
  | "sync.completed"
  | "grade.updated"
  | "nudge.acted"
  | "nudge.dismissed"
  | "automation.cycle-started"
  | "automation.cycle-finished"
  | "automation.watcher-failed";

export interface AutomationEvent {
  name: AutomationEventName;
  householdId: string;
  at: string; // ISO timestamp
  payload: Record<string, string | number | boolean | null>;
}

type Handler = (event: AutomationEvent) => void | Promise<void>;

const handlers = new Map<AutomationEventName, Set<Handler>>();

export function onAutomationEvent(name: AutomationEventName, handler: Handler): () => void {
  let set = handlers.get(name);
  if (!set) {
    set = new Set();
    handlers.set(name, set);
  }
  set.add(handler);
  return () => {
    set!.delete(handler);
  };
}

/** Emit a domain event. Never throws — a broken subscriber must not break the emitter. */
export function emitAutomationEvent(
  name: AutomationEventName,
  householdId: string,
  payload: AutomationEvent["payload"] = {},
): void {
  const event: AutomationEvent = {
    name,
    householdId,
    at: new Date().toISOString(),
    payload,
  };
  const set = handlers.get(name);
  if (!set) return;
  for (const handler of set) {
    try {
      const result = handler(event);
      if (result instanceof Promise) {
        result.catch(() => {
          /* subscriber errors are swallowed by design */
        });
      }
    } catch {
      /* subscriber errors are swallowed by design */
    }
  }
}

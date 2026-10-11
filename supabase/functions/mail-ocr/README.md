# mail-ocr Edge Function (planned — v1 runs inline)

Spec: `docs/MODULE-ARCHITECTURE.md` §3.3. The canonical `OcrProvider`
contract lives in `providers/types.ts` (mirrored at
`src/server/ocr/providers.ts` for the Next runtime — keep in sync).

**v1 status:** the OCR pipeline runs INLINE in the Next API route
`POST /api/v1/household/mail/items/[itemId]/ocr` with the stub provider
behind the seeded `workers-ai-vision` registry row. No Edge Function is
deployed yet, and no real vision model is wired — the stub returns
clearly-labeled placeholder text ("OCR not configured") with confidence 0,
and the pipeline skips deterministic extraction for confidence-0 readings.

**Move to this Edge Function when a real provider is chosen** (spec §7 Q6
recommends a Workers-AI vision model, inside our Cloudflare trust boundary):
1. Implement an adapter module here behind `OcrProvider` (e.g.
   `providers/workers-ai.ts`), matching the registry row's
   `adapter_module` value.
2. The pipeline contract (§3.3 steps 1–7): load item → consent-gated
   provider resolution → `provider.ocr(bytes)` → deterministic extraction
   (reuse `src/server/ocr/extract.ts` logic — port, don't re-derive) →
   handwriting short-circuit → UPDATE `mail_items` → CREATE
   `mail_action_items` (7-day/2-day reminders, weekend→Friday, second-notice
   dedupe on `(sender, amount)`) → audit `mail_item.ocr_completed` with
   `actor_kind='worker'`.
3. The consent gate is checked TWICE: in the API route AND here — the gate
   is not trust-on-entry. External providers (`is_external=true`) are refused
   without `mail_items.external_ocr_consent = true`.

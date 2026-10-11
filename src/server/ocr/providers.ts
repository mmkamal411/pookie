// W21 mail intelligence — pluggable OCR provider layer.
// Spec: docs/MODULE-ARCHITECTURE.md §3.3. Canonical contract (mirrored at
// supabase/functions/mail-ocr/providers/types.ts for the future Edge Function;
// the two MUST stay in sync).
//
// v1 ships ONE provider: a stub behind the seeded 'workers-ai-vision'
// registry row. No vendor is hardcoded. The v1 recommendation (Workers AI
// vision) is a future adapter module + registry row, never a schema change.
import type { SupabaseClient } from '@supabase/supabase-js';

export interface OcrBlock {
  text: string;
  confidence: number;
  kind: 'print' | 'handwriting';
  /** x, y, w, h normalized 0..1 */
  bbox?: [number, number, number, number];
}

export interface OcrResult {
  /** Full reading-order text. */
  text: string;
  /** 0..1 aggregate confidence. 0 = "no usable reading" (stub). */
  confidence: number;
  blocks: OcrBlock[];
  handwritingDetected: boolean;
}

export interface OcrProvider {
  /** === mail_ocr_providers.provider_key */
  readonly key: string;
  /** true => may only be used with per-document external_ocr_consent. */
  readonly isExternal: boolean;
  /** The provider never claims handwriting it cannot read. */
  readonly handlesHandwriting: boolean;
  ocr(
    image: Uint8Array,
    opts?: { languageHints?: string[] },
  ): Promise<OcrResult>;
}

export interface OcrProviderRow {
  provider_key: string;
  display_name: string;
  adapter_module: string;
  handles_handwriting: boolean;
  is_external: boolean;
  data_residency: string | null;
  active: boolean;
}

/**
 * v1 stub provider. Returns clearly-labeled placeholder text with confidence 0
 * so the pipeline skips deterministic extraction (no garbage fields from a
 * non-reading). "OCR not configured" is the honest label, surfaced in the UI.
 */
export class StubOcrProvider implements OcrProvider {
  readonly key = 'workers-ai-vision';
  readonly isExternal = false;
  readonly handlesHandwriting = false;

  async ocr(_image: Uint8Array): Promise<OcrResult> {
    return {
      text: '[OCR not configured] This document has not been read yet. Connect a vision provider to extract its contents.',
      confidence: 0,
      blocks: [],
      handwritingDetected: false,
    };
  }
}

/**
 * Resolve a provider from the mail_ocr_providers registry.
 * - providerKey given: must exist and be active (unavailable error otherwise).
 * - default: first active local (is_external=false) provider.
 * v1 maps the seeded 'workers-ai-vision' row to the stub. Any other
 * adapter_module is a future adapter — resolved here, implemented later.
 */
export async function resolveOcrProvider(
  supabase: SupabaseClient,
  providerKey?: string,
): Promise<{ provider: OcrProvider; row: OcrProviderRow }> {
  const { data, error } = await supabase
    .from('mail_ocr_providers')
    .select(
      'provider_key, display_name, adapter_module, handles_handwriting, is_external, data_residency, active',
    )
    .eq('active', true)
    .order('provider_key');
  if (error)
    throw new Error(`ocr registry read failed: ${(error as Error).message}`);
  const rows = (data ?? []) as OcrProviderRow[];

  const row = providerKey
    ? rows.find((r) => r.provider_key === providerKey) ?? null
    : (rows.find((r) => !r.is_external) ?? null);
  if (!row) {
    const e = new Error(
      providerKey
        ? `unknown or inactive OCR provider: ${providerKey}`
        : 'no active local OCR provider',
    );
    (e as { code?: string }).code = 'OCR_PROVIDER_UNAVAILABLE';
    throw e;
  }

  // v1: the seeded local row maps to the stub. Future adapters register here
  // by adapter_module (e.g. 'mail-ocr/providers/workers-ai').
  if (row.adapter_module === 'mail-ocr/providers/workers-ai') {
    return { provider: new StubOcrProvider(), row };
  }
  const e = new Error(
    `OCR adapter not implemented in v1: ${row.adapter_module}`,
  );
  (e as { code?: string }).code = 'OCR_PROVIDER_UNAVAILABLE';
  throw e;
}

/** Map provider-resolution failures to the canonical API error code. */
export function isProviderUnavailable(err: unknown): boolean {
  return (
    err instanceof Error &&
    (err as { code?: string }).code === 'OCR_PROVIDER_UNAVAILABLE'
  );
}

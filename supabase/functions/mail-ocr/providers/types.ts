// Canonical OcrProvider contract — mirrors src/server/ocr/providers.ts
// (Next.js runtime). The two MUST stay in sync. This Deno module is the
// contract the future mail-ocr Edge Function implements; the Next API route
// runs the same pipeline inline for v1 (stub provider).

export interface OcrBlock {
  text: string;
  confidence: number;
  kind: "print" | "handwriting";
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
  readonly handlesHandwriting: boolean;
  ocr(
    image: Uint8Array,
    opts?: { languageHints?: string[] },
  ): Promise<OcrResult>;
}

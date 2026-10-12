// Unit tests: /auth/callback pure helpers.
// Run: node --test src/lib/auth/callback-helpers.test.ts  (no extra deps)
import { test } from "node:test";
import assert from "node:assert/strict";
import { safePostAuthNext, authFailureCode } from "./callback-helpers.ts";

test("safePostAuthNext allows same-origin paths", () => {
  assert.equal(safePostAuthNext("/onboarding"), "/onboarding");
  assert.equal(
    safePostAuthNext("/verify-invite?token=abc"),
    "/verify-invite?token=abc",
  );
});

test("safePostAuthNext rejects protocol-relative and absolute URLs", () => {
  assert.equal(safePostAuthNext("//evil.com"), "/");
  assert.equal(safePostAuthNext("https://evil.com/x"), "/");
  assert.equal(safePostAuthNext("javascript:alert(1)"), "/");
});

test("safePostAuthNext falls back to / for missing/empty input", () => {
  assert.equal(safePostAuthNext(null), "/");
  assert.equal(safePostAuthNext(""), "/");
});

test("authFailureCode maps expired grants", () => {
  assert.equal(
    authFailureCode("invalid_grant: code has expired"),
    "auth_expired",
  );
  assert.equal(authFailureCode("Token expired"), "auth_expired");
});

test("authFailureCode maps PKCE verifier loss", () => {
  assert.equal(
    authFailureCode("code verifier not found in storage"),
    "auth_pkce",
  );
  assert.equal(authFailureCode("PKCE flow failed"), "auth_pkce");
});

test("authFailureCode defaults to auth", () => {
  assert.equal(authFailureCode("unexpected failure"), "auth");
  assert.equal(authFailureCode(""), "auth");
});

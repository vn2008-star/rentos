/**
 * Reading a caught value safely.
 *
 * A `catch` binding is `unknown` — anything can be thrown, not just an Error —
 * so every call site that wanted `err.message` was annotating `catch (err: any)`
 * to get at it. That silences the checker rather than handling the case: when
 * something threw a string, or a plain object, `err?.message` was `undefined`
 * and the user got "undefined" in a toast.
 *
 * Kept out of utils.ts deliberately. That module pulls in clsx and
 * tailwind-merge for `cn`, and the API route handlers that need these helpers
 * have no business importing styling code.
 */

/** True for a value we can safely index. Rules out null, which typeof calls "object". */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * The human-readable message from a thrown value, or `fallback` if it has none.
 *
 * The fallback is the point: it is what stops a non-Error throw from reaching a
 * user as the literal text "undefined".
 */
export function errorMessage(err: unknown, fallback = "Something went wrong."): string {
  if (err instanceof Error && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  if (isRecord(err) && typeof err.message === "string" && err.message) return err.message;
  return fallback;
}

/**
 * The `code` a thrown value carries, if any.
 *
 * Firebase Auth uses strings ("auth/wrong-password"); the Firestore admin SDK
 * uses numeric gRPC codes (6 = ALREADY_EXISTS). Both pass through unchanged so
 * callers compare against whichever they expect.
 */
export function errorCode(err: unknown): string | number | undefined {
  if (isRecord(err) && (typeof err.code === "string" || typeof err.code === "number")) {
    return err.code;
  }
  return undefined;
}

/**
 * Loads a Node package at runtime without the bundler rewriting the specifier.
 *
 * Next treats `firebase-admin` as a server external (it is on Next's built-in
 * list). Turbopack compiles `import("firebase-admin/app")` into an import of a
 * content-hashed alias — `firebase-admin-a14c8a5423a75469/app` — and satisfies
 * it with a symlink in `.next/node_modules` pointing at an ABSOLUTE path in the
 * build machine's node_modules.
 *
 * That symlink survives the Firebase frameworks packaging step, but its target
 * does not exist inside the deployed container. Every route that touched the
 * Admin SDK therefore failed in production with:
 *
 *   Failed to load external module firebase-admin-a14c8a5423a75469/app:
 *   ERR_MODULE_NOT_FOUND
 *
 * It works locally, where the symlink's target is real, which is what let it go
 * unnoticed. `new Function` puts the import beyond the bundler's static
 * analysis, so nothing is rewritten and Node resolves the real package from the
 * deployed node_modules — where firebase-admin genuinely is, as a dependency in
 * the generated package.json.
 */
export const nodeImport: (specifier: string) => Promise<any> = new Function(
  "specifier",
  "return import(specifier)"
) as (specifier: string) => Promise<any>;

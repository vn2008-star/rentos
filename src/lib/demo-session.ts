/**
 * Which organization the public "View Demo" tour runs in.
 *
 * Shared by the API route and the client so the two cannot disagree about which
 * portfolio a visitor is being shown. Override with DEMO_ORG_ID to point the
 * tour somewhere else — the route rewrites the visitor's profile on every
 * visit, so a change takes effect immediately.
 */
export const DEFAULT_DEMO_ORG_ID = "org-1";

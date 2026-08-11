"use client";

import { auth } from "./firebase";

/**
 * Calls one of our API routes as the signed-in user.
 *
 * Server routes identify the caller from a Firebase ID token and nothing else —
 * never from ids in the request body — so every privileged call has to carry
 * one. This is the only place that token is attached, so no route can be called
 * "as somebody else" by accident.
 */
export async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const user = auth.currentUser;
  if (!user) throw new Error("You are signed out — please sign in again.");

  const token = await user.getIdToken();
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(path, { ...init, headers });
}

/**
 * authedFetch plus JSON handling, surfacing the server's own error text.
 *
 * A generic "request failed" would hide the specific, actionable messages these
 * routes return — "that web address is taken", "your card was declined".
 */
export async function authedJson<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const res = await authedFetch(path, init);
  const text = await res.text();
  const data = text ? JSON.parse(text) : {};

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

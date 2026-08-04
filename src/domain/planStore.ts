// Local-first storage for the season plan.
//
// localStorage is what the UI reads and writes, so edits never wait on the
// network and the planner still works offline or on `vite dev` (where the
// Netlify function doesn't exist). Netlify Blobs is the shared copy: pulled
// once on load, pushed on a debounce after edits. Newest `updatedAt` wins.

import { emptyDoc, normalizeDoc, type PlanDoc } from './plan';

export const PLAN_KEY = 'booth-builder:plan:v2';
export const TOKEN_KEY = 'booth-builder:planner-token';
const ENDPOINT = '/api/plan';

export type SyncState =
  | 'idle' // nothing to say yet
  | 'loading' // first pull in flight
  | 'saving'
  | 'synced'
  | 'local' // no cloud available; this device only
  | 'locked' // the endpoint wants a token we don't have
  | 'error';

// ---------- Local ----------

export function loadLocal(): PlanDoc | null {
  try {
    const raw = localStorage.getItem(PLAN_KEY);
    if (!raw) return null;
    return normalizeDoc(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function saveLocal(doc: PlanDoc): void {
  try {
    localStorage.setItem(PLAN_KEY, JSON.stringify(doc));
  } catch {
    // Private mode or quota — the in-memory doc is still correct.
  }
}

export function loadToken(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

export function saveToken(token: string): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Not fatal; the request just won't be authorized next reload.
  }
}

// ---------- Remote ----------

export type RemoteResult =
  | { ok: true; doc: PlanDoc | null }
  | { ok: false; reason: 'locked' | 'unavailable'; doc?: PlanDoc | null };

function headers(token: string): HeadersInit {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (token) h['x-planner-token'] = token;
  return h;
}

export async function pullRemote(token: string): Promise<RemoteResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, { headers: headers(token) });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (res.status === 401) return { ok: false, reason: 'locked' };
  if (!res.ok) return { ok: false, reason: 'unavailable' };
  try {
    const body = (await res.json()) as { doc?: unknown };
    return { ok: true, doc: body.doc ? normalizeDoc(body.doc) : null };
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
}

export async function pushRemote(doc: PlanDoc, token: string): Promise<RemoteResult> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: 'PUT',
      headers: headers(token),
      body: JSON.stringify(doc),
    });
  } catch {
    return { ok: false, reason: 'unavailable' };
  }
  if (res.status === 401) return { ok: false, reason: 'locked' };
  if (res.status === 409) {
    // Someone else saved something newer. Hand it back so the caller can adopt.
    try {
      const body = (await res.json()) as { doc?: unknown };
      return { ok: false, reason: 'unavailable', doc: body.doc ? normalizeDoc(body.doc) : null };
    } catch {
      return { ok: false, reason: 'unavailable' };
    }
  }
  if (!res.ok) return { ok: false, reason: 'unavailable' };
  return { ok: true, doc };
}

/** Whichever doc was edited most recently. Ties go to local. */
export function newer(a: PlanDoc | null, b: PlanDoc | null): PlanDoc {
  if (a && b) return b.updatedAt > a.updatedAt ? b : a;
  return a ?? b ?? emptyDoc();
}

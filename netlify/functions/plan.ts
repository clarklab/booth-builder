// Season plan storage, backed by Netlify Blobs.
//
// One document, one store — this is a single shop's planner, not a
// multi-tenant service. GET reads it, PUT replaces it.
//
// Access: if PLANNER_TOKEN is set in the Netlify environment the endpoint
// requires it in an x-planner-token header, and the app prompts for it once.
// With no token set the endpoint is open, which is the zero-config default but
// means anyone who finds the URL can read and overwrite the plan. Set the
// variable if that matters to you.

import { getStore } from '@netlify/blobs';

const STORE = 'booth-planner';
const KEY = 'season';

/** Generous ceiling for a hand-maintained plan; stops junk PUTs. */
const MAX_BYTES = 512 * 1024;
const MAX_EVENTS = 2000;

export default async (req: Request): Promise<Response> => {
  const token = process.env.PLANNER_TOKEN;
  if (token && req.headers.get('x-planner-token') !== token) {
    return json({ error: 'unauthorized' }, 401);
  }

  let store: ReturnType<typeof getStore>;
  try {
    store = getStore(STORE);
  } catch (err) {
    // Blobs isn't wired up (e.g. running the function outside Netlify).
    return json({ error: 'blobs unavailable', detail: String(err) }, 503);
  }

  if (req.method === 'GET') {
    const doc = await store.get(KEY, { type: 'json' }).catch(() => null);
    return json({ doc: doc ?? null });
  }

  if (req.method === 'PUT') {
    const body = await req.text();
    if (body.length > MAX_BYTES) {
      return json({ error: 'too large' }, 413);
    }

    let incoming: unknown;
    try {
      incoming = JSON.parse(body);
    } catch {
      return json({ error: 'invalid json' }, 400);
    }

    const doc = validate(incoming);
    if (!doc) return json({ error: 'invalid plan document' }, 422);

    // Last edit wins, but never let a stale tab overwrite a newer save.
    const existing = (await store.get(KEY, { type: 'json' }).catch(() => null)) as
      | { updatedAt?: unknown }
      | null;
    if (
      existing &&
      typeof existing.updatedAt === 'string' &&
      existing.updatedAt > doc.updatedAt
    ) {
      return json({ error: 'stale', doc: existing }, 409);
    }

    await store.setJSON(KEY, doc);
    return json({ doc });
  }

  return json({ error: 'method not allowed' }, 405);
};

type StoredDoc = { version: number; updatedAt: string; events: unknown[] };

function validate(raw: unknown): StoredDoc | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.updatedAt !== 'string' || !o.updatedAt) return null;
  if (!Array.isArray(o.events) || o.events.length > MAX_EVENTS) return null;
  // Field-level shape is the client's business — it re-normalizes whatever it
  // reads back. This is just a guard against storing something unusable.
  if (!o.events.every((e) => e && typeof e === 'object')) return null;
  return {
    version: typeof o.version === 'number' ? o.version : 2,
    updatedAt: o.updatedAt,
    events: o.events,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
      'cache-control': 'no-store',
    },
  });
}

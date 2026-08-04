import { useCallback, useEffect, useRef, useState } from 'react';
import {
  clearLegacy,
  emptyDoc,
  isPristine,
  migrateLegacy,
  withEvents,
  type PlanDoc,
  type PlanEvent,
} from './domain/plan';
import {
  loadLocal,
  loadToken,
  newer,
  pullRemote,
  pushRemote,
  saveLocal,
  saveToken,
  type SyncState,
} from './domain/planStore';

/** How long after the last keystroke to push to the cloud. */
const PUSH_DELAY_MS = 1200;
/**
 * ...but never sit on unsaved changes longer than this. Without a ceiling a
 * long editing session keeps resetting the debounce and nothing reaches the
 * cloud until the user pauses.
 */
const MAX_PUSH_WAIT_MS = 8000;

export type PlanApi = {
  doc: PlanDoc;
  sync: SyncState;
  /** Set once a cloud pull or push has succeeded at least once. */
  cloudReady: boolean;
  setEvents: (fn: (events: PlanEvent[]) => PlanEvent[]) => void;
  unlock: (token: string) => void;
  retry: () => void;
};

export function usePlan(): PlanApi {
  const [doc, setDoc] = useState<PlanDoc>(() => {
    const local = loadLocal();
    if (local) return local;
    // First run on this device: fold in anything the old one-shot wizard left
    // behind so an existing plan isn't silently dropped.
    const migrated = migrateLegacy();
    if (migrated.length > 0) {
      clearLegacy();
      return withEvents(migrated);
    }
    return emptyDoc();
  });

  const [sync, setSync] = useState<SyncState>('loading');
  const [cloudReady, setCloudReady] = useState(false);
  const [token, setToken] = useState<string>(() => loadToken());

  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** When the oldest still-unpushed edit landed. */
  const pendingSince = useRef<number | null>(null);
  // Skip the push that would otherwise fire for the doc we just pulled.
  const skipPush = useRef(true);
  const latest = useRef(doc);
  latest.current = doc;

  // Local write is synchronous and unconditional — the cloud is a bonus.
  useEffect(() => {
    saveLocal(doc);
  }, [doc]);

  const pull = useCallback(
    async (tok: string) => {
      setSync('loading');
      const res = await pullRemote(tok);
      if (!res.ok) {
        setSync(res.reason === 'locked' ? 'locked' : 'local');
        return;
      }
      setCloudReady(true);
      const merged = newer(latest.current, res.doc);
      if (merged !== latest.current) {
        skipPush.current = true;
        setDoc(merged);
        setSync('synced');
        return;
      }
      // Local is ahead — publish it. Never push a doc the user hasn't
      // touched; an untouched doc is empty, and writing it would clear the
      // cloud copy for everyone else.
      if (!isPristine(latest.current) && (!res.doc || res.doc.updatedAt < latest.current.updatedAt)) {
        setSync('saving');
        const put = await pushRemote(latest.current, tok);
        setSync(put.ok ? 'synced' : put.reason === 'locked' ? 'locked' : 'local');
      } else {
        setSync('synced');
      }
    },
    [],
  );

  useEffect(() => {
    void pull(token);
  }, [pull, token]);

  // Debounced push after edits.
  useEffect(() => {
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    if (!cloudReady) return;
    if (pushTimer.current) clearTimeout(pushTimer.current);
    if (pendingSince.current === null) pendingSince.current = Date.now();
    const waited = Date.now() - pendingSince.current;
    const delay = Math.max(0, Math.min(PUSH_DELAY_MS, MAX_PUSH_WAIT_MS - waited));
    setSync('saving');
    pushTimer.current = setTimeout(() => {
      pendingSince.current = null;
      void (async () => {
        const res = await pushRemote(latest.current, token);
        if (res.ok) {
          setSync('synced');
        } else if (res.reason === 'locked') {
          setSync('locked');
        } else if (res.doc) {
          // The cloud moved on underneath us; take the newer copy.
          skipPush.current = true;
          setDoc(res.doc);
          setSync('synced');
        } else {
          setSync('error');
        }
      })();
    }, delay);
    return () => {
      if (pushTimer.current) clearTimeout(pushTimer.current);
    };
  }, [doc, cloudReady, token]);

  const setEvents = useCallback((fn: (events: PlanEvent[]) => PlanEvent[]) => {
    setDoc((cur) => withEvents(fn(cur.events)));
  }, []);

  const unlock = useCallback((next: string) => {
    saveToken(next);
    setToken(next);
  }, []);

  const retry = useCallback(() => {
    void pull(token);
  }, [pull, token]);

  return { doc, sync, cloudReady, setEvents, unlock, retry };
}

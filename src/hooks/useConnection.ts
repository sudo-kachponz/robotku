// src/hooks/useConnection.ts
//
// React bridge over the framework-agnostic app store (src/app/store.ts). Uses
// useSyncExternalStore so every component re-renders on connection changes while
// the store itself stays free of any React import.
//
// Correctness notes (learned the hard way):
//  - The `subscribe` passed to useSyncExternalStore MUST be a stable reference,
//    otherwise React re-subscribes every render. store.subscribe() replays the
//    current state immediately on subscribe, so an unstable subscribe + a fresh
//    snapshot object = infinite render loop.
//  - getState() returns a NEW object each call, so we keep a cached snapshot and
//    only swap its reference when a field actually changed.

import { useSyncExternalStore } from 'react';
import { subscribe as storeSubscribe, getState, type AppState } from '../app/store';

let cache: AppState = getState();
const listeners = new Set<() => void>();

function changed(a: AppState, b: AppState): boolean {
  return (
    a.mode !== b.mode ||
    a.transport !== b.transport ||
    a.connState !== b.connState ||
    a.robotInfo !== b.robotInfo
  );
}

// One persistent subscription to the plain store keeps `cache` fresh with a
// reference that only changes on a real state change, then fans out to React.
storeSubscribe((s) => {
  if (changed(s, cache)) {
    cache = s;
    for (const l of listeners) l();
  }
});

// Stable references for useSyncExternalStore.
function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}
function getSnapshot(): AppState {
  return cache;
}

export function useConnection(): AppState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

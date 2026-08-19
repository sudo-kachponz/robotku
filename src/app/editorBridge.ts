// src/app/editorBridge.ts
//
// Tiny hand-off between the Projects page and the Block Coding editor. Client-side
// navigation keeps module state alive, so Projects can stash a workspace here and
// the editor picks it up on mount. Not persisted — just an in-memory baton.

let pending: unknown | null = null;

export function setPendingWorkspace(ws: unknown): void {
  pending = ws;
}

/** Return the pending workspace (if any) and clear it. */
export function takePendingWorkspace(): unknown | null {
  const p = pending;
  pending = null;
  return p;
}

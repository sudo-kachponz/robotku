// src/ui/dialog.tsx
//
// Promise-based confirm/prompt dialogs — a DS-styled replacement for the native
// window.confirm / window.prompt (which are ugly, un-brandable, and blocked in
// some embedded webviews). Imperative API mirrors src/ui/toast.ts:
//
//   if (await confirmDialog('Hapus project?', { danger: true })) { ... }
//   const name = await promptDialog('Nama baru:', { defaultValue: old });
//
// A single <DialogHost/> (mounted once in _app.tsx) renders whatever is open.

import { useEffect, useRef, useState } from 'react';

type DialogRequest = {
  id: number;
  kind: 'confirm' | 'prompt';
  message: string;
  title?: string;
  defaultValue?: string;
  confirmLabel?: string;
  danger?: boolean;
  resolve: (value: string | boolean | null) => void;
};

let seq = 0;
let current: DialogRequest | null = null;
let listeners: Array<(r: DialogRequest | null) => void> = [];

function emit() {
  for (const l of listeners) l(current);
}

function open(req: Omit<DialogRequest, 'id' | 'resolve'>): Promise<string | boolean | null> {
  // If a dialog is already open, resolve it as cancelled before replacing it.
  current?.resolve(current.kind === 'confirm' ? false : null);
  return new Promise((resolve) => {
    current = { ...req, id: ++seq, resolve };
    emit();
  });
}

/** Ask the user to confirm. Resolves true (confirmed) or false (cancelled). */
export function confirmDialog(
  message: string,
  opts: { title?: string; confirmLabel?: string; danger?: boolean } = {},
): Promise<boolean> {
  return open({ ...opts, message, kind: 'confirm' }) as Promise<boolean>;
}

/** Ask the user for text. Resolves the trimmed string, or null if cancelled/empty. */
export function promptDialog(
  message: string,
  opts: { title?: string; defaultValue?: string; confirmLabel?: string } = {},
): Promise<string | null> {
  return open({ ...opts, message, kind: 'prompt' }) as Promise<string | null>;
}

export function DialogHost() {
  const [req, setReq] = useState<DialogRequest | null>(null);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const l = (r: DialogRequest | null) => {
      setReq(r);
      setValue(r?.defaultValue ?? '');
    };
    listeners.push(l);
    return () => {
      listeners = listeners.filter((x) => x !== l);
    };
  }, []);

  useEffect(() => {
    if (req?.kind === 'prompt') inputRef.current?.select();
  }, [req]);

  if (!req) return null;

  const settle = (result: string | boolean | null) => {
    req.resolve(result);
    current = null;
    emit();
  };
  const cancel = () => settle(req.kind === 'confirm' ? false : null);
  const accept = () => {
    if (req.kind === 'confirm') return settle(true);
    const v = value.trim();
    settle(v ? v : null);
  };

  const accent = req.danger ? '#EF4444' : '#4F46E5';

  return (
    <div
      onClick={cancel}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        background: 'rgba(30, 27, 75, 0.45)',
        backdropFilter: 'blur(2px)',
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={req.title ?? req.message}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') cancel();
          if (e.key === 'Enter' && req.kind === 'prompt') accept();
        }}
        style={{
          width: 'min(420px, 100%)',
          background: '#fff',
          borderRadius: '18px',
          boxShadow: '0 24px 60px rgba(30, 27, 75, 0.35)',
          padding: '22px 22px 18px',
          fontFamily: 'var(--font-jakarta), system-ui, sans-serif',
          color: '#1E1B4B',
        }}
      >
        {req.title && (
          <h3 style={{ margin: '0 0 6px', fontSize: '18px', fontWeight: 800 }}>{req.title}</h3>
        )}
        <p style={{ margin: 0, fontSize: '14px', lineHeight: 1.5, color: '#334155' }}>
          {req.message}
        </p>

        {req.kind === 'prompt' && (
          <input
            ref={inputRef}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            style={{
              width: '100%',
              marginTop: '14px',
              padding: '10px 12px',
              fontSize: '14px',
              fontFamily: 'inherit',
              borderRadius: '10px',
              border: '1.5px solid #C7D2FE',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        )}

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '18px' }}>
          <button
            onClick={cancel}
            style={{
              padding: '9px 16px',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'inherit',
              borderRadius: '10px',
              border: '1.5px solid #E2E8F0',
              background: '#fff',
              color: '#475569',
              cursor: 'pointer',
            }}
          >
            Batal
          </button>
          <button
            autoFocus={req.kind === 'confirm'}
            onClick={accept}
            style={{
              padding: '9px 16px',
              fontSize: '14px',
              fontWeight: 700,
              fontFamily: 'inherit',
              borderRadius: '10px',
              border: 'none',
              background: accent,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            {req.confirmLabel ?? (req.danger ? 'Hapus' : 'OK')}
          </button>
        </div>
      </div>
    </div>
  );
}

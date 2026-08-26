// src/components/modes/HoldButton.tsx
//
// Press-and-hold button used by D-pad / turret / turn controls. Fires onStart on
// press (pointer or bound key) and onStop on release. Keyboard is de-duped so a
// held key doesn't re-fire onStart.

import { useEffect, useRef, type ReactNode } from 'react';

export default function HoldButton({
  onStart,
  onStop,
  keys,
  className,
  activeClassName,
  children,
  ariaLabel,
}: {
  onStart: () => void;
  onStop: () => void;
  keys?: string[];
  className?: string;
  activeClassName?: string;
  children: ReactNode;
  ariaLabel?: string;
}) {
  const ref = useRef<HTMLButtonElement | null>(null);
  const heldRef = useRef(false);

  const start = () => {
    if (heldRef.current) return;
    heldRef.current = true;
    ref.current?.classList.add(activeClassName ?? '');
    onStart();
  };
  const stop = () => {
    if (!heldRef.current) return;
    heldRef.current = false;
    ref.current?.classList.remove(activeClassName ?? '');
    onStop();
  };

  useEffect(() => {
    if (!keys || keys.length === 0) return;
    const match = (e: KeyboardEvent) =>
      keys.includes(e.key) || keys.includes(e.code) || keys.includes(e.key.toLowerCase());
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (match(e)) {
        e.preventDefault();
        start();
      }
    };
    const up = (e: KeyboardEvent) => {
      if (match(e)) {
        e.preventDefault();
        stop();
      }
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
     
  }, [keys?.join(',')]);

  return (
    <button
      ref={ref}
      className={className}
      aria-label={ariaLabel}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onPointerLeave={stop}
    >
      {children}
    </button>
  );
}

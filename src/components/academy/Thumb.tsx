// src/components/academy/Thumb.tsx
//
// Lesson thumbnail with a graceful fallback. Seed thumbnails may not exist on
// disk; on the first (and only) load error we swap the <img> for a CSS gradient
// tile so there is no repeated 404 spam.

import { useState } from 'react';
import styles from '../../styles/Academy.module.css';

export function Thumb({ src, alt, emoji }: { src: string; alt: string; emoji?: string }) {
  const [failed, setFailed] = useState(false);
  return (
    <div className={styles.thumb}>
      {!failed && (
        <img
          className={styles.thumbImg}
          src={src}
          alt={alt}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      )}
      {failed && (
        <div className={styles.thumbFallback} aria-hidden>
          {emoji ?? '🤖'}
        </div>
      )}
    </div>
  );
}

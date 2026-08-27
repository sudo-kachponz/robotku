// src/types/assets.d.ts
//
// Standalone ambient declarations for non-code imports (CSS Modules + images).
//
// Next generates these into next-env.d.ts, but that file is git-ignored and only
// written by `next build`. On a clean checkout `npm run typecheck` runs before any
// build, so without this file tsc fails with TS2307 on every CSS Module / asset
// import. Declaring them here makes `typecheck` self-contained.
//
// Images match Next's behaviour: a static import resolves to a StaticImageData
// object (with `.src`), though call sites also guard for a bare URL string — so
// the exported type is the union of both to keep either usage type-safe.

interface StaticImageDataLike {
  src: string;
  height: number;
  width: number;
  blurDataURL?: string;
}

declare module '*.module.css' {
  const classes: Record<string, string>;
  export default classes;
}

declare module '*.svg' {
  const src: string | StaticImageDataLike;
  export default src;
}

declare module '*.png' {
  const src: string | StaticImageDataLike;
  export default src;
}

declare module '*.jpg' {
  const src: string | StaticImageDataLike;
  export default src;
}

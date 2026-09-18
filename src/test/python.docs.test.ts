// src/test/python.docs.test.ts
//
// py2.md §2.1 guards: every apiMap `docs` slug resolves to a registry entry, every
// snippet points at a real slug, every seeAlso resolves, and entries are complete.

import { describe, it, expect } from 'vitest';
import { API } from '../pythongen/apiMap';
import { SNIPPETS } from '../pythongen/snippets';
import { DOCS, allDocs } from '../pythongen/docs/registry';

describe('docs registry', () => {
  it('every apiMap entry with a docs slug has a registry entry', () => {
    const missing = API.filter((e) => e.docs && !DOCS[e.docs]).map((e) => `${e.block} -> ${e.docs}`);
    expect(missing).toEqual([]);
  });

  it('every flyout snippet points at a real slug', () => {
    const missing = SNIPPETS.filter((s) => !DOCS[s.docs]).map((s) => `${s.id} -> ${s.docs}`);
    expect(missing).toEqual([]);
  });

  it('every seeAlso slug resolves', () => {
    const broken: string[] = [];
    for (const d of allDocs()) {
      for (const s of d.seeAlso ?? []) if (!DOCS[s]) broken.push(`${d.slug} -> ${s}`);
    }
    expect(broken).toEqual([]);
  });

  it('every entry is complete (title, summary, description, signature, blockPreview)', () => {
    for (const d of allDocs()) {
      expect(d.title, d.slug).toBeTruthy();
      expect(d.summary, d.slug).toBeTruthy();
      expect(d.description, d.slug).toBeTruthy();
      expect(d.signature.python, d.slug).toBeTruthy();
      expect(d.blockPreview.blockType, d.slug).toBeTruthy();
    }
  });

  it('slugs are unique', () => {
    const slugs = allDocs().map((d) => d.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

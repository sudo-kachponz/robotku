// src/components/blockcoding/python/PyEditor.tsx
//
// CodeMirror 6 editor for the Robotku-Python dialect. Loaded via next/dynamic in
// BlockCoding so the CM6 bundle only ships when the user opens Python mode (keeps
// the Blocks-mode bundle small — the three.js pattern). Light theme, gutter,
// 4-space indent, basic dialect highlighting, and diagnostics from the compiler.

import { useEffect, useRef } from 'react';
import { EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { tags as t } from '@lezer/highlight';
import { linter, lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import styles from './PyEditor.module.css';

export type PyProblem = { line: number; message: string; severity: 'error' | 'warning' };

const KEYWORDS = /^(while|for|if|elif|else|def|return|break|continue|pass|and|or|not|in|range|True|False|None)\b/;

const dialect = StreamLanguage.define({
  token(stream) {
    if (stream.eatSpace()) return null;
    if (stream.match(/#.*/)) return 'comment';
    if (stream.match(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'/)) return 'string';
    if (stream.match(/\d+(?:\.\d+)?/)) return 'number';
    if (stream.match(KEYWORDS)) return 'keyword';
    if (stream.match(/[A-Za-z_][\w.]*/)) return 'variableName';
    stream.next();
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: t.keyword, color: '#a626a4', fontWeight: '600' },
  { tag: t.comment, color: '#9aa0b4', fontStyle: 'italic' },
  { tag: t.string, color: '#c18401' },
  { tag: t.number, color: '#986801' },
  { tag: t.variableName, color: '#1b1840' },
]);

const theme = EditorView.theme(
  {
    '&': { height: '100%', fontSize: '15px', backgroundColor: '#ffffff', color: '#1b1840' },
    '.cm-scroller': { fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace", lineHeight: '1.7' },
    '.cm-gutters': { backgroundColor: '#f7f8fc', color: '#b9bdd4', border: 'none' },
    '.cm-activeLineGutter': { backgroundColor: '#eef0ff' },
    '.cm-activeLine': { backgroundColor: 'rgba(238,240,255,0.5)' },
    '.cm-content': { padding: '12px 0' },
    '&.cm-focused': { outline: 'none' },
  },
  { dark: false },
);

function toDiagnostics(view: EditorView, problems: PyProblem[]): Diagnostic[] {
  const doc = view.state.doc;
  return problems
    .filter((p) => p.line >= 1 && p.line <= doc.lines)
    .map((p) => {
      const line = doc.line(p.line);
      return { from: line.from, to: line.to, severity: p.severity, message: p.message };
    });
}

export default function PyEditor({
  value,
  onChange,
  problems = [],
  onReady,
}: {
  value: string;
  onChange: (v: string) => void;
  problems?: PyProblem[];
  onReady?: (view: EditorView) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastEmitted = useRef(value);

  useEffect(() => {
    if (!hostRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        indentUnit.of('    '),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        dialect,
        syntaxHighlighting(highlight),
        lintGutter(),
        linter(() => []), // diagnostics are pushed via setDiagnostics on `problems` change
        theme,
        EditorView.updateListener.of((u) => {
          if (u.docChanged) {
            const text = u.state.doc.toString();
            lastEmitted.current = text;
            onChange(text);
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: hostRef.current });
    viewRef.current = view;
    onReady?.(view);
    return () => {
      view.destroy();
      viewRef.current = null;
    };

  }, []);

  // External value updates (e.g. seeded from blocks) — replace without clobbering
  // the user's in-progress typing.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    if (value !== lastEmitted.current && value !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: value } });
      lastEmitted.current = value;
    }
  }, [value]);

  // Push compiler/board diagnostics into the gutter + inline underlines.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(setDiagnostics(view.state, toDiagnostics(view, problems)));
  }, [problems]);

  return <div ref={hostRef} className={styles.editor} />;
}

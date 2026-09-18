// src/components/blockcoding/python/PyEditor.tsx
//
// CodeMirror 6 editor for the Robotku-Python dialect. Loaded via next/dynamic in
// BlockCoding so the CM6 bundle only ships when the user opens Python mode (keeps
// the Blocks-mode bundle small — the three.js pattern). Light theme, gutter,
// 4-space indent, basic dialect highlighting, and diagnostics from the compiler.

import { useEffect, useRef } from 'react';
import { EditorState, Compartment, type Extension } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, dropCursor, hoverTooltip } from '@codemirror/view';
import { allDocs, getDoc } from '../../../pythongen/docs/registry';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, HighlightStyle, syntaxHighlighting, indentUnit } from '@codemirror/language';
import { snippet } from '@codemirror/autocomplete';
import { tags as t } from '@lezer/highlight';
import { linter, lintGutter, setDiagnostics, type Diagnostic } from '@codemirror/lint';
import styles from './PyEditor.module.css';

export type PyProblem = { line: number; message: string; severity: 'error' | 'warning' };
export interface PyEditorApi {
  view: EditorView;
  insertSnippet: (template: string) => void;
}

// Insert a CM6 snippet template (${n:...} placeholders, Tab between them) as its own
// line at `pos`, indented to match the target line. Multi-line templates keep shape.
const DRAG_MIME = 'application/x-robotku-snippet';
function insertSnippetAt(view: EditorView, template: string, pos: number) {
  const line = view.state.doc.lineAt(pos);
  const indent = /^\s*/.exec(line.text)?.[0] ?? '';
  const tpl = template.replace(/\t/g, '    ').replace(/\n/g, '\n' + indent);
  const at = line.to;
  const lead = line.text.trim() ? '\n' + indent : indent;
  view.dispatch({ changes: { from: at, insert: lead } });
  const start = at + lead.length;
  snippet(tpl)(view, null, start, start);
  view.focus();
}

// Map an API call name (e.g. "robot.forward") to its docs slug, from the registry.
const FN_TO_SLUG: Record<string, string> = {};
for (const d of allDocs()) {
  const m = /^([A-Za-z_][\w.]*)\s*\(/.exec(d.signature.python);
  if (m) FN_TO_SLUG[m[1]] = d.slug;
}

// Hover an API identifier -> compact tooltip (title + summary) with a "Selengkapnya"
// link that opens the full docs. Colours via tokens (theme-aware, no hardcoded hex).
function apiHoverTooltip(onOpenDocs?: (slug: string) => void) {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const re = /[A-Za-z_][\w.]*/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line.text))) {
      const s = line.from + m.index;
      const e = s + m[0].length;
      if (pos < s || pos > e) continue;
      const slug = FN_TO_SLUG[m[0]];
      if (!slug) return null;
      const d = getDoc(slug);
      return {
        pos: s,
        end: e,
        above: true,
        create() {
          const dom = document.createElement('div');
          dom.style.cssText =
            'max-width:280px;padding:8px 10px;font-family:"Plus Jakarta Sans",sans-serif;' +
            'background:var(--surface);color:var(--ink-700);border:1px solid var(--line);' +
            'border-radius:10px;box-shadow:var(--shadow-md);font-size:12.5px;line-height:1.45;';
          const title = document.createElement('div');
          title.textContent = d?.title ?? m![0];
          title.style.cssText =
            'font-family:"JetBrains Mono",monospace;font-weight:800;color:var(--ink-900);margin-bottom:2px;';
          dom.appendChild(title);
          const sum = document.createElement('div');
          sum.textContent = d?.summary ?? '';
          dom.appendChild(sum);
          if (onOpenDocs) {
            const more = document.createElement('button');
            more.textContent = 'Selengkapnya →';
            more.style.cssText =
              'margin-top:6px;border:none;background:transparent;color:var(--indigo-600);' +
              'font-weight:700;font-size:12px;cursor:pointer;padding:0;';
            more.onclick = () => onOpenDocs(slug);
            dom.appendChild(more);
          }
          return { dom };
        },
      };
    }
    return null;
  });
}

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

// --- Theme is token-driven (C4): read --code-* from :root at runtime and rebuild
// via a Compartment on theme change, so the editor never hardcodes colours and
// swapping themes preserves state + undo history (no reload).
const CODE_TOKENS = [
  'bg', 'fg', 'gutter-bg', 'gutter-fg', 'active-line', 'selection',
  'keyword', 'string', 'number', 'comment', 'ident', 'fn', 'error', 'warn',
] as const;
type CodeVars = Record<(typeof CODE_TOKENS)[number], string>;

function readCodeVars(): CodeVars {
  const s = getComputedStyle(document.documentElement);
  const v = {} as CodeVars;
  for (const k of CODE_TOKENS) v[k] = s.getPropertyValue('--code-' + k).trim() || 'currentColor';
  return v;
}

// Rough luminance for a #rrggbb bg → decide dark mode (for CM's native bits).
function isDarkBg(bg: string): boolean {
  const m = /^#([0-9a-f]{6})$/i.exec(bg);
  if (!m) return false;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 < 0.5;
}

function buildTheme(v: CodeVars): Extension {
  return [
    syntaxHighlighting(
      HighlightStyle.define([
        { tag: t.keyword, color: v.keyword, fontWeight: '600' },
        { tag: t.comment, color: v.comment, fontStyle: 'italic' },
        { tag: t.string, color: v.string },
        { tag: t.number, color: v.number },
        { tag: t.variableName, color: v.ident },
      ]),
    ),
    EditorView.theme(
      {
        '&': { height: '100%', fontSize: '15px', backgroundColor: v.bg, color: v.fg },
        '.cm-scroller': {
          fontFamily: "'JetBrains Mono', ui-monospace, 'SF Mono', Menlo, monospace",
          lineHeight: '1.7',
        },
        '.cm-gutters': { backgroundColor: v['gutter-bg'], color: v['gutter-fg'], border: 'none' },
        '.cm-activeLineGutter': { backgroundColor: v['active-line'] },
        '.cm-activeLine': { backgroundColor: v['active-line'] },
        '.cm-cursor': { borderLeftColor: v.fg },
        '.cm-selectionBackground, .cm-content ::selection': { backgroundColor: v.selection },
        '&.cm-focused .cm-selectionBackground': { backgroundColor: v.selection },
        '.cm-content': { padding: '12px 0' },
        '&.cm-focused': { outline: 'none' },
      },
      { dark: isDarkBg(v.bg) },
    ),
  ];
}

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
  onOpenDocs,
}: {
  value: string;
  onChange: (v: string) => void;
  problems?: PyProblem[];
  onReady?: (api: PyEditorApi) => void;
  onOpenDocs?: (slug: string) => void;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const lastEmitted = useRef(value);
  const themeComp = useRef(new Compartment());

  useEffect(() => {
    if (!hostRef.current) return;
    const themeCompartment = themeComp.current;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        history(),
        indentUnit.of('    '),
        dropCursor(),
        keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
        dialect,
        lintGutter(),
        linter(() => []), // diagnostics are pushed via setDiagnostics on `problems` change
        apiHoverTooltip(onOpenDocs),
        themeCompartment.of(buildTheme(readCodeVars())),
        EditorView.domEventHandlers({
          dragover(e) {
            if (e.dataTransfer?.types.includes(DRAG_MIME)) {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'copy';
            }
          },
          drop(e, v) {
            const tpl = e.dataTransfer?.getData(DRAG_MIME);
            if (!tpl) return;
            e.preventDefault();
            const pos = v.posAtCoords({ x: e.clientX, y: e.clientY }) ?? v.state.doc.length;
            insertSnippetAt(v, tpl, pos);
          },
        }),
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
    onReady?.({ view, insertSnippet: (tpl) => insertSnippetAt(view, tpl, view.state.selection.main.head) });
    return () => {
      view.destroy();
      viewRef.current = null;
    };

  }, []);

  // Rebuild editor colours when the app theme changes (data-theme on <html>) —
  // reconfigure the compartment, so state + undo history stay intact (no reload).
  useEffect(() => {
    const apply = () => {
      const view = viewRef.current;
      if (view) view.dispatch({ effects: themeComp.current.reconfigure(buildTheme(readCodeVars())) });
    };
    const obs = new MutationObserver(apply);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme', 'class', 'style'],
    });
    window.addEventListener('robotku:themechange', apply);
    return () => {
      obs.disconnect();
      window.removeEventListener('robotku:themechange', apply);
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

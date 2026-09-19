// src/components/blockcoding/python/PyFlyout.tsx
//
// HTML flyout for Python mode (matches Blockly's flyout behavior:
// rail stays visible; clicking a category or searching opens a spacious flyout drawer next to it).
// Each card: inline overview/docs ("More ∨"), syntax preview with indentation guides,
// drag handle (⠿), and "Copy Code" option.

import { useState } from 'react';
import { useAppTheme } from '../../../theme/themeManager';
import { getCategoryColor } from '../../../visual/categoryColors';
import { categoryIconSvg } from '../../../visual/categoryIcons';
import { SNIPPETS, SNIPPET_CATEGORIES, type Snippet } from '../../../pythongen/snippets';
import { getDoc } from '../../../pythongen/docs/registry';
import {
  DragDotsIcon,
  CopyIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  SearchIcon,
} from '../sim/SimIcons';
import styles from './PyFlyout.module.css';

const DRAG_MIME = 'application/x-robotku-snippet';

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  if (name === 'Search') {
    return <SearchIcon className={className} size={18} />;
  }
  const markup = categoryIconSvg(name);
  if (!markup) return <span className={styles.dot} />;
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
      dangerouslySetInnerHTML={{ __html: markup }}
    />
  );
}

function highlightPythonLine(line: string) {
  const parts: React.ReactNode[] = [];
  const regex = /(#[^\n]*)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')|\b(while|for|if|elif|else|def|return|break|continue|pass|and|or|not|in|range|True|False|None)\b|(\b\d+(?:\.\d+)?\b)|(\b[A-Za-z_][\w.]*\b)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const [full, comment, str, keyword, num, ident] = match;
    if (comment) {
      parts.push(
        <span key={match.index} className={styles.tokComment}>
          {full}
        </span>,
      );
    } else if (str) {
      parts.push(
        <span key={match.index} className={styles.tokString}>
          {full}
        </span>,
      );
    } else if (keyword) {
      parts.push(
        <span key={match.index} className={styles.tokKeyword}>
          {full}
        </span>,
      );
    } else if (num) {
      parts.push(
        <span key={match.index} className={styles.tokNumber}>
          {full}
        </span>,
      );
    } else if (ident) {
      parts.push(
        <span key={match.index} className={styles.tokIdent}>
          {full}
        </span>,
      );
    } else {
      parts.push(full);
    }
    lastIndex = regex.lastIndex;
  }
  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }
  return parts.length > 0 ? parts : line;
}

export default function PyFlyout({
  onInsert,
  onDocs,
  onToggleCollapse,
}: {
  onInsert: (py: string) => void;
  onDocs?: (s: Snippet) => void;
  onToggleCollapse?: () => void;
}) {
  const { theme: currentTheme } = useAppTheme();
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const query = q.trim().toLowerCase();
  const searching = query.length > 0;

  const isOpen = searching || activeCat !== null;
  const currentCategory = activeCat || SNIPPET_CATEGORIES[0];
  const catColor = searching
    ? currentTheme === 'space'
      ? '#38BDF8'
      : '#EC2D8F'
    : getCategoryColor(currentCategory, currentTheme);

  const cards = searching
    ? SNIPPETS.filter(
        (s) =>
          s.label.toLowerCase().includes(query) ||
          s.desc.toLowerCase().includes(query) ||
          s.py.toLowerCase().includes(query),
      )
    : activeCat
      ? SNIPPETS.filter((s) => s.category === activeCat)
      : [];

  const handleCategoryClick = (c: string) => {
    if (activeCat === c && !searching) {
      setActiveCat(null);
    } else {
      setActiveCat(c);
      setQ('');
    }
  };

  const handleClose = () => {
    setActiveCat(null);
    setQ('');
  };

  const handleCopyCode = async (code: string, id: string) => {
    const clean = code.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\t/g, '    ');
    try {
      await navigator.clipboard.writeText(clean);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1800);
    } catch {
      // ignore
    }
  };

  const toggleExpand = (id: string, s: Snippet) => {
    setExpandedId((prev) => (prev === id ? null : id));
    onDocs?.(s);
  };

  const renderSnippetCode = (pyCode: string) => {
    const cleanCode = pyCode.replace(/\$\{\d+:([^}]+)\}/g, '$1').replace(/\t/g, '    ');
    const lines = cleanCode.split('\n');

    return lines.map((line, idx) => {
      const isIndented = /^(\s{2,}|\t)/.test(line);
      const prevIndented = idx > 0 && /^(\s{2,}|\t)/.test(lines[idx - 1]);
      const nextIndented = idx < lines.length - 1 && /^(\s{2,}|\t)/.test(lines[idx + 1]);

      const isFirstIndent = isIndented && !prevIndented;
      const isLastIndent = isIndented && !nextIndented;

      return (
        <span
          key={idx}
          className={`${styles.codeLine} ${isIndented ? styles.codeLineIndented : ''} ${isFirstIndent ? styles.codeLineFirstIndent : ''} ${isLastIndent ? styles.codeLineLastIndent : ''}`}
        >
          {highlightPythonLine(line)}
        </span>
      );
    });
  };

  const renderCard = (s: Snippet) => {
    const c = getCategoryColor(s.category, currentTheme);
    const isExpanded = expandedId === s.id;
    const isCopied = copiedId === s.id;
    const doc = getDoc(s.docs);

    return (
      <div
        key={s.id}
        className={styles.card}
        style={{ ['--cat' as string]: c }}
      >
        {/* Card Header */}
        <div className={styles.cardHeader}>
          <div className={styles.cardTitleGroup}>
            <span className={styles.cardTitle}>{s.label}</span>
          </div>
          <button
            type="button"
            className={styles.moreBtn}
            onClick={() => toggleExpand(s.id, s)}
            title={isExpanded ? 'Sembunyikan dokumentasi' : 'Buka dokumentasi'}
            aria-expanded={isExpanded}
          >
            <span>{isExpanded ? 'Less' : 'More'}</span>
            {isExpanded ? <ChevronUpIcon size={12} /> : <ChevronDownIcon size={12} />}
          </button>
        </div>

        {/* Short Description */}
        <div className={styles.cardDesc}>{s.desc}</div>

        {/* Inline Overview / Documentation Accordion */}
        {isExpanded && doc && (
          <div className={styles.inlineDoc}>
            <div className={styles.docDesc}>{doc.description || doc.summary}</div>

            {doc.params && doc.params.length > 0 && (
              <div className={styles.docSection}>
                <div className={styles.docSectionTitle}>Parameter</div>
                <div className={styles.docParams}>
                  {doc.params.map((p) => (
                    <div key={p.name} className={styles.docParamRow}>
                      <div className={styles.docParamHead}>
                        <span className={styles.docParamName}>{p.name}</span>
                        <span className={styles.docParamType}>({p.type})</span>
                        {p.default && (
                          <span className={styles.docParamDefault}>= {p.default}</span>
                        )}
                      </div>
                      <div className={styles.docParamDetail}>{p.desc}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {doc.returns && (
              <div className={styles.docSection}>
                <div className={styles.docSectionTitle}>Kembalian</div>
                <div className={styles.docReturn}>
                  <code>{doc.returns.type}</code> — {doc.returns.desc}
                </div>
              </div>
            )}

            <a
              href={`/docs/reference/${doc.slug}/`}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.docLink}
              title="Buka panduan lengkap di tab baru"
            >
              Buka referensi lengkap ↗
            </a>
          </div>
        )}

        {/* Interactive Code Box (Draggable, Clickable, Copyable) */}
        <div
          className={styles.codeBox}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(DRAG_MIME, s.py);
            e.dataTransfer.effectAllowed = 'copy';
            const ghost = document.createElement('div');
            ghost.textContent = s.label;
            ghost.className = styles.ghost;
            ghost.style.setProperty('--cat', c);
            document.body.appendChild(ghost);
            e.dataTransfer.setDragImage(ghost, 12, 12);
            setTimeout(() => ghost.remove(), 0);
          }}
          onClick={() => onInsert(s.py)}
          title="Klik untuk menyisipkan ke editor · Tarik untuk meletakkan"
        >
          {/* Drag Handle on Left */}
          <div className={styles.dragGrip} title="Tarik ke editor">
            <DragDotsIcon size={14} />
          </div>

          {/* Code Content */}
          <div className={styles.codeContent}>{renderSnippetCode(s.py)}</div>

          {/* Action buttons on top-right */}
          <div className={styles.codeActions}>
            <button
              type="button"
              className={`${styles.actionBtn} ${isCopied ? styles.actionBtnCopied : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                handleCopyCode(s.py, s.id);
              }}
              title="Salin kode Python"
            >
              {isCopied ? (
                <>
                  <CheckIcon size={11} />
                  <span>Disalin</span>
                </>
              ) : (
                <>
                  <CopyIcon size={11} />
                  <span>Copy</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.flyout}>
      {/* Category Rail (Toolbox) */}
      <div className={styles.rail}>
        {/* Search Bar at top of rail */}
        <div className={styles.railSearch}>
          <div className={styles.railSearchInputWrap}>
            <input
              type="text"
              className={styles.railSearchInput}
              placeholder="Search..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Cari blok Python"
            />
            {q ? (
              <button
                type="button"
                className={styles.railSearchClear}
                onClick={() => setQ('')}
                aria-label="Hapus pencarian"
                title="Hapus"
              >
                ✕
              </button>
            ) : (
              <SearchIcon className={styles.railSearchIcon} size={15} />
            )}
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              className={styles.railCollapseBtn}
              onClick={onToggleCollapse}
              title="Sembunyikan Kategori (–)"
              aria-label="Sembunyikan Kategori"
            >
              –
            </button>
          )}
        </div>

        {/* Categories List */}
        <div className={styles.railList}>
          {SNIPPET_CATEGORIES.map((c) => {
            const isSelected = !searching && c === activeCat;
            const color = getCategoryColor(c, currentTheme);
            return (
              <button
                key={c}
                className={`${styles.railBtn} ${isSelected ? styles.railActive : ''}`}
                style={{ ['--cat' as string]: color }}
                onClick={() => handleCategoryClick(c)}
                title={`Kategori ${c}`}
                aria-expanded={isSelected}
              >
                <span className={styles.railIcon}>
                  <CategoryIcon name={c} />
                </span>
                <span className={styles.railLabel}>{c}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Flyout Drawer / Panel */}
      {isOpen && (
        <div className={styles.drawer} style={{ ['--cat' as string]: catColor }}>
          <div className={styles.drawerHead}>
              <div className={styles.drawerTitleRow}>
                <div className={styles.drawerTitle}>
                  <span className={styles.drawerIcon}>
                    <CategoryIcon name={searching ? 'Search' : currentCategory} />
                  </span>
                  <span className={styles.drawerTitleText}>
                    {searching ? `Pencarian ("${q}")` : currentCategory}
                  </span>
                  <span className={styles.drawerCount}>{cards.length}</span>
                </div>
                <button
                  className={styles.closeBtn}
                  onClick={handleClose}
                  aria-label="Tutup panel blok"
                  title="Tutup"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className={styles.cards}>
              {cards.length === 0 ? (
                <div className={styles.noResult}>
                  {searching
                    ? `Tidak ada blok yang cocok dengan "${q}".`
                    : 'Tidak ada blok dalam kategori ini.'}
                </div>
              ) : (
                cards.map(renderCard)
              )}
            </div>
          </div>
      )}
    </div>
  );
}


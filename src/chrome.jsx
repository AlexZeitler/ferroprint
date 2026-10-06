// Editor chrome: the sheet frame, toolbars, inspector, panels, title block and status bar.
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { TYPE_NAME, TOOL_NAMES, KEY_OF, LABELLESS, NOFILL, NOLINE, TURN, trunc, toolName, nodeTitle, nodeMeta, bounds } from './engine.js';
import { renderNode, renderEdge } from './draw.jsx';
import { TEMPLATES } from './templates.js';
import { ICONS, PALETTE, LIBRARY_ICON, PIN_ICON } from './icons.jsx';
import { CATEGORIES, ToolIcon } from './library.jsx';
import { PROVIDERS, PROVIDER_NAME, FRAMES, loadCloud, onCloudLoad, cloudSet, cloudFailed } from './cloud.js';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = IS_MAC ? '⌘' : 'Ctrl ';
const SHIFT = IS_MAC ? '⇧' : 'Shift ';
const ALT = IS_MAC ? '⌥' : 'Alt ';
const KSHIFT = '⇧';

const cx = (...c) => c.filter(Boolean).join(' ');

function Btn({ on, className, children, ...rest }) {
  return (
    <button type="button" className={cx('btn', on !== undefined && 'toggle', on && 'on', className)} aria-pressed={on} {...rest}>
      {children}
    </button>
  );
}

function Seg({ label, opts, value, onChange }) {
  return (
    <div className="seg-row">
      <div className="caption">{label}</div>
      <div className="seg" role="group" aria-label={label}>
        {opts.map(([val, text]) => (
          <button type="button" key={String(val)} className={cx(val === value && 'on')} aria-pressed={val === value} onClick={() => onChange(val)}>{text}</button>
        ))}
      </div>
    </div>
  );
}

// Text field for numbers. It commits on Enter or blur, so partial input such as "-" is allowed.
function NumField({ label, value, onCommit, disabled }) {
  const [draft, setDraft] = useState(null);
  const cancel = useRef(false);
  const commit = () => {
    if (cancel.current) { cancel.current = false; setDraft(null); return; }
    if (draft == null) return;
    const v = parseFloat(draft);
    setDraft(null);
    if (Number.isFinite(v) && v !== value) onCommit(v);
  };
  const onKeyDown = e => {
    if (e.key === 'Enter') e.currentTarget.blur();
    else if (e.key === 'Escape') { cancel.current = true; e.currentTarget.blur(); }
    else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault();
      const base = parseFloat(draft ?? value);
      const v = (Number.isFinite(base) ? base : value) + (e.key === 'ArrowUp' ? 1 : -1) * (e.shiftKey ? 10 : 1);
      setDraft(null);
      onCommit(v);
    }
  };
  return (
    <label className="numfield">
      <span>{label}</span>
      <input type="text" inputMode="decimal" spellCheck={false} disabled={disabled} value={draft ?? String(value)} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKeyDown} />
    </label>
  );
}

export function Frame({ cols, rows, texture }) {
  const cells = (list, cls) => list.map(c => <div key={c} className={cls}>{c}</div>);
  return (
    <>
      <div className="texture" style={{ backgroundImage: texture }} />
      <div className="vignette" />
      <div className="frame-outer" />
      <div className="frame-inner" />
      <div className="ruler ruler-top">{cells(cols, 'ruler-col')}</div>
      <div className="ruler ruler-bottom">{cells(cols, 'ruler-col')}</div>
      <div className="ruler ruler-left">{cells(rows, 'ruler-row')}</div>
      <div className="ruler ruler-right">{cells(rows, 'ruler-row')}</div>
    </>
  );
}

const SAVE_TEXT = {
  saved: ['SAVED', 'Your work is saved in this browser.'],
  pending: ['SAVING', 'Saving to this browser.'],
  error: ['NOT SAVED', 'This browser could not save your work. Storage is full or blocked. Export JSON to keep a copy.'],
  off: ['NOT SAVED', 'This browser blocks local storage. Export JSON to keep a copy of your work.']
};

export function TopBar({ barRef, save, canUndo, canRedo, snap, dims, mode, panel, on }) {
  const [saveText, saveTitle] = SAVE_TEXT[save];
  return (
    <div className="topbar" ref={barRef}>
      <div className="group brand" title={saveTitle}>
        <div className="mark"><div /></div>
        <h1>FERROPRINT</h1>
        <span className={cx('save-state', (save === 'error' || save === 'off') && 'warn')} role="status">{saveText}</span>
      </div>
      <div className="group">
        <Btn title={`Undo (${MOD}Z)`} onClick={on.undo} disabled={!canUndo}>Undo</Btn>
        <Btn title={`Redo (${SHIFT}${MOD}Z)`} onClick={on.redo} disabled={!canRedo}>Redo</Btn>
      </div>
      <div className="group">
        <Btn on={snap} title="Snap to grid" onClick={on.snap}>Snap</Btn>
        <Btn on={dims} title="Show dimensions on the selected shape" onClick={on.dims}>Dims</Btn>
        <Btn on={mode === 'blue'} className="split" title="Blueprint: white lines on blue paper" onClick={on.blue}>Blue</Btn>
        <Btn on={mode === 'white'} title="Whiteprint: blue lines on white paper" onClick={on.white}>White</Btn>
      </div>
      <div className="group">
        <Btn on={panel === 'new'} title="A blank project, a blank sheet or a template" onClick={on.newDoc}>New</Btn>
        <Btn title={`Open a Ferroprint JSON file (${MOD}O)`} onClick={on.open}>Open</Btn>
        <Btn on={panel === 'share'} title="Share this project with a link" onClick={on.share}>Share</Btn>
        <div className="group-label split">EXPORT</div>
        <Btn className="plain" title="Download this sheet as PNG" onClick={on.png}>PNG</Btn>
        <Btn className="plain" title="Download this sheet as SVG" onClick={on.svg}>SVG</Btn>
        <Btn className="plain" title={`Download all sheets as JSON (${MOD}S)`} onClick={on.json}>JSON</Btn>
      </div>
      <div className="group">
        <Btn on={panel === 'setup'} title="Lettering, grid and connector defaults" onClick={on.setup}>Setup</Btn>
        <Btn on={panel === 'help'} title="Keyboard shortcuts (?)" onClick={on.help}>Keys</Btn>
      </div>
    </div>
  );
}

export function Palette({ tool, onTool, recent, pins, onUnpin, theme, libraryOpen, onLibrary, onSymbol }) {
  const group = g => (
    <div key={g.label}>
      <div className="caption">{g.label.toUpperCase()}</div>
      <div className="tools">
        {g.tools.map(id => {
          const name = TOOL_NAMES[id], key = KEY_OF[id];
          return (
            <button type="button" key={id} className={cx('tool', tool === id && 'on')} aria-pressed={tool === id} aria-label={name} title={key ? `${name} · ${key}` : name} onClick={() => onTool(id)}>
              {ICONS[id]}
            </button>
          );
        })}
      </div>
    </div>
  );
  // The library sits under the draw tools, so it stays in view on short screens.
  // Pinned shapes come first. The recent shapes follow, without the pinned ones.
  const libTool = (id, pinned) => (
    <button
      type="button" key={id} className={cx('tool', tool === id && 'on')} aria-pressed={tool === id} aria-label={toolName(id)}
      title={pinned ? `${toolName(id)} · right-click to unpin` : toolName(id)}
      onClick={() => onSymbol(id)} onContextMenu={pinned ? e => { e.preventDefault(); onUnpin(id); } : undefined}
    >
      <ToolIcon id={id} size={22} t={theme} />
    </button>
  );
  const library = (
    <div key="library">
      <div className="caption">LIBRARY</div>
      <div className="tools">
        <button type="button" className={cx('tool', libraryOpen && 'on')} aria-pressed={libraryOpen} aria-label="Library" title="Library: doors, furniture, cloud icons and more · /" onClick={onLibrary}>
          {LIBRARY_ICON}
        </button>
        {pins.map(id => libTool(id, true))}
        {recent.filter(id => !pins.includes(id)).map(id => libTool(id, false))}
      </div>
    </div>
  );
  return (
    <nav className="palette" aria-label="Tools">
      {group(PALETTE[0])}
      {library}
      {PALETTE.slice(1).map(group)}
    </nav>
  );
}

const CLOUD_SEARCH_MAX = 48;
let lastView = 'all';

// One list of shapes for the panel. Each item is a tool id and a name.
// A word that starts with the query ranks above a match inside a word.
function librarySections(view, q, pins) {
  const score = (...words) => {
    if (!q) return 1;
    const text = words.join(' ').toLowerCase();
    if (!text.includes(q)) return 0;
    return (' ' + text).replace(/[^a-z0-9]+/g, ' ').includes(' ' + q.replace(/[^a-z0-9]+/g, ' ').trim()) ? 2 : 1;
  };
  const ranked = list => list.map((it, i) => ({ ...it, i })).filter(it => it.s > 0).sort((a, b) => b.s - a.s || a.i - b.i);
  if (view === 'pinned') return [{ key: 'pinned', title: 'Pinned', items: ranked(pins.map(id => ({ id, name: toolName(id), s: score(toolName(id)) }))) }];
  const base = CATEGORIES.filter(c => view === 'all' || c.id === view).map(c => ({
    key: c.id, title: c.name, items: ranked(c.items.map(sym => ({ id: sym.id, name: sym.name, s: score(sym.name, sym.keys || '', c.name) })))
  }));
  const cloud = PROVIDERS.filter(p => view === p.id || (view === 'all' && q.length >= 2)).flatMap(p => {
    const set = cloudSet(p.id);
    // Frames are zones with the provider's group icon. They come first in a provider's view.
    const frames = ranked(FRAMES.filter(f => f.p === p.id).map(f => ({ id: `frame:${f.id}`, name: `${f.name} frame`, s: score(f.name, 'frame boundary group zone', view === 'all' ? p.name : '') })));
    const item = (k, g) => ({ id: `cloud:${p.id}/${k}`, name: set.icons[k].n, s: score(set.icons[k].n, g.n, view === 'all' ? p.name : '') });
    if (view === 'all') {
      const seen = new Set(), all = [...frames, ...(set ? ranked(set.groups.flatMap(g => g.i.filter(k => !seen.has(k) && seen.add(k)).map(k => item(k, g)))) : [])];
      const more = all.length > CLOUD_SEARCH_MAX ? ` · first ${CLOUD_SEARCH_MAX} of ${all.length}, open ${p.name} for all` : '';
      return [{ key: p.id, title: p.name + more, items: all.slice(0, CLOUD_SEARCH_MAX) }];
    }
    return [{ key: p.id + ':frames', title: 'Frames', items: frames }, ...(set ? set.groups.map(g => ({ key: p.id + g.n, title: g.n, items: ranked(g.i.map(k => item(k, g))) })) : [])];
  });
  return [...base, ...cloud].filter(sec => sec.items.length);
}

// The panel can hold hundreds of tiles, so it renders only when its own props change.
export const LibraryPanel = memo(function LibraryPanel({ tool, theme, pins, onPin, onPick, onDragStart, onClose }) {
  const [query, setQuery] = useState('');
  const [view, setViewState] = useState(lastView);
  const [, setGen] = useState(0);
  const setView = v => { lastView = v; setViewState(v); };
  const coarse = useMemo(() => typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches, []);
  const q = query.trim().toLowerCase();
  const searchAll = view === 'all' && q.length >= 2;
  useEffect(() => onCloudLoad(() => setGen(g => g + 1)), []);
  // A cloud set loads when its view opens, or when a search in All needs it.
  useEffect(() => {
    const ids = PROVIDER_NAME[view] ? [view] : searchAll ? PROVIDERS.map(p => p.id) : view === 'pinned' ? pins.filter(id => id.startsWith('cloud:')).map(id => id.slice(6).split('/')[0]) : [];
    ids.forEach(id => loadCloud(id).catch(() => {}));
  }, [view, searchAll, pins]);
  const sections = librarySections(view, q, pins);
  const first = sections.length ? sections[0].items[0] : null;
  const provider = PROVIDER_NAME[view];
  const loading = provider ? !cloudSet(view) && !cloudFailed(view) : searchAll && PROVIDERS.some(p => !cloudSet(p.id) && !cloudFailed(p.id));
  const onKeyDown = e => {
    if (e.key === 'Escape') { e.stopPropagation(); if (query) setQuery(''); else onClose(); }
    else if (e.key === 'Enter' && first) { e.preventDefault(); onPick(first.id); }
  };
  const nav = [['pinned', 'Pinned', pins.length], ['all', 'All'], ...CATEGORIES.map(c => [c.id, c.name, c.items.length])];
  const navBtn = ([id, name, count]) => (
    <button type="button" key={id} className={cx(view === id && 'on')} aria-pressed={view === id} onClick={() => setView(id)}>
      <span>{name}</span>{count != null && <span className="count">{count}</span>}
    </button>
  );
  return (
    <aside className="panel float library" aria-label="Library">
      <header><h2>LIBRARY</h2><button type="button" className="close" onClick={onClose}>CLOSE</button></header>
      <div className="lib-head">
        <input className="field" type="search" value={query} placeholder="Find a shape: door, bed, lambda, bigquery…" aria-label="Find a shape" autoFocus={!coarse} spellCheck={false} onChange={e => setQuery(e.target.value)} onKeyDown={onKeyDown} />
      </div>
      <div className="lib-main">
        <nav className="lib-nav" aria-label="Library groups">
          <div className="caption">SHAPES</div>
          {nav.map(navBtn)}
          <div className="caption">CLOUD</div>
          {PROVIDERS.map(p => navBtn([p.id, p.name, cloudSet(p.id) ? Object.keys(cloudSet(p.id).icons).length : null]))}
        </nav>
        <div className="lib-body">
          {sections.map(sec => (
            <section key={sec.key} className="lib-section">
              <div className="caption">{sec.title.toUpperCase()}</div>
              <div className="tiles">
                {sec.items.map(it => {
                  const pinned = pins.includes(it.id);
                  return (
                    <div className="tile-wrap" key={it.id}>
                      <button
                        type="button" className={cx('tile', tool === it.id && 'on')} aria-pressed={tool === it.id} title={`${it.name}: click, then place it on the sheet, or drag it onto the sheet`}
                        onClick={() => onPick(it.id)}
                        onPointerDown={e => { if (e.pointerType === 'mouse' && e.button === 0) onDragStart(it.id, e); }}
                      >
                        <ToolIcon id={it.id} size={40} t={theme} />
                        <span>{it.name}</span>
                      </button>
                      <button type="button" className={cx('pin', pinned && 'on')} aria-pressed={pinned} aria-label={pinned ? `Unpin ${it.name}` : `Pin ${it.name} to the toolbar`} title={pinned ? 'Unpin from the toolbar' : 'Pin to the toolbar'} onClick={() => onPin(it.id)}>
                        {PIN_ICON}
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
          {loading && <p className="hint">Loading {provider || 'cloud'} icons…</p>}
          {provider && cloudFailed(view) && (
            <p className="hint">Could not load the {provider} icons. Check the connection, then <button type="button" className="link" onClick={() => loadCloud(view).catch(() => {})}>try again</button>.</p>
          )}
          {!sections.length && !loading && !(provider && cloudFailed(view)) && (
            <p className="hint">
              {view === 'pinned' && !q ? 'Nothing is pinned yet. Use the pin on a shape to keep it in the toolbar.' : `No shape matches “${query}”. Try a different word, or choose All.`}
            </p>
          )}
        </div>
      </div>
      <p className="hint lib-foot">
        {coarse
          ? 'Tap a shape, then tap or drag on the sheet. The pin keeps a shape in the toolbar.'
          : 'Click a shape, then click or drag on the sheet, or drag it onto the sheet. The pin keeps a shape in the toolbar. Doors and furniture rotate with ⇧R.'}
      </p>
    </aside>
  );
});

const SOLID = [[false, 'Solid'], [true, 'Dashed']];

const SIDE_OPTS = [['auto', 'Auto'], ['top', '↑'], ['right', '→'], ['bottom', '↓'], ['left', '←']];

// Action buttons in two columns. An odd last button takes the full row.
function Acts({ list }) {
  const shown = list.filter(Boolean);
  return (
    <footer>
      {shown.map(([label, fn, extra = {}], i) => (
        <button type="button" key={label} className={cx('act', extra.danger && 'danger', (extra.wide || (i === shown.length - 1 && shown.length % 2)) && 'wide')} title={extra.title} disabled={extra.disabled} onClick={fn}>{label}</button>
      ))}
    </footer>
  );
}

export function Inspector({ nodes, edges, nodeById, fmt, setNode, setEdge, act }) {
  if (nodes.length === 1 && !edges.length) {
    const n = nodes[0], id = n.id, locked = !!n.locked;
    const set = (patch, key) => setNode(id, patch, key);
    return (
      <aside className="panel inspector" aria-label="Inspector">
        <header><h2 title={nodeTitle(n)}>{nodeTitle(n)}</h2><span>{nodeMeta(n) || `${fmt(n.w)} × ${fmt(n.h)}`}</span></header>
        {!LABELLESS[n.type] && (
          <section>
            <div className="caption">LABEL</div>
            <textarea rows={2} value={n.label} onChange={e => set({ label: e.target.value }, 'label' + id)} />
            <div className="caption">DETAIL</div>
            <input className="field mono" value={n.sub} placeholder={n.type === 'room' ? 'Area is shown automatically' : 'e.g. Postgres 16'} onChange={e => set({ sub: e.target.value }, 'sub' + id)} />
          </section>
        )}
        <section>
          <div className="caption">POSITION · SIZE (PX){locked ? ' · LOCKED' : ''}</div>
          <div className="geom">
            {['x', 'y', 'w', 'h'].map(f => (
              <NumField key={id + f} label={f.toUpperCase()} value={Math.round(n[f])} disabled={locked} onCommit={v => set({ [f]: f === 'w' || f === 'h' ? Math.max(1, v) : v }, 'geo' + f + id)} />
            ))}
          </div>
        </section>
        <section>
          {!NOLINE[n.type] && <Seg label="LINE" opts={SOLID} value={!!n.dashed} onChange={v => set({ dashed: v })} />}
          {!NOFILL[n.type] && <Seg label="FILL" opts={[['none', 'None'], ['tint', 'Tint'], ['hatch', 'Hatch']]} value={n.fill || 'none'} onChange={v => set({ fill: v })} />}
          {!LABELLESS[n.type] && <Seg label="TEXT" opts={[['s', 'S'], ['m', 'M'], ['l', 'L']]} value={n.size || 'm'} onChange={v => set({ size: v })} />}
          {(n.type === 'path' || n.type === 'line') && <Seg label="WEIGHT" opts={[['s', 'Fine'], ['m', 'Medium'], ['l', 'Wall']]} value={n.weight || 'm'} onChange={v => set({ weight: v })} />}
        </section>
        <Acts list={[
          ['TO FRONT', act.front], ['TO BACK', act.back],
          TURN[n.type] && !locked && ['ROTATE 90°', act.rotate, { title: 'Rotate 90° clockwise (⇧R)' }],
          TURN[n.type] && !locked && ['FLIP', act.flip, { title: 'Mirror left to right (⇧H)' }],
          [locked ? 'UNLOCK' : 'LOCK', act.lock, { title: `${locked ? 'Unlock' : 'Lock'} the shape (${KSHIFT}${MOD}L)` }],
          ['DUPLICATE', act.dup],
          n.group && ['UNGROUP', act.ungroup, { title: `Ungroup the shapes (${KSHIFT}${MOD}G)` }],
          n.type === 'zone' && n.icon && ['REMOVE ICON', act.noIcon, { title: 'Remove the frame icon from the tab' }],
          ['DELETE', act.del, { danger: true, disabled: locked, title: locked ? 'Unlock the shape to delete it' : undefined }]
        ]} />
      </aside>
    );
  }
  if (edges.length === 1 && !nodes.length) {
    const e = edges[0], id = e.id, bends = e.pts ? e.pts.length : 0;
    const set = (patch, key) => setEdge(id, patch, key);
    const nm = n => (n ? trunc(String(n.label || TYPE_NAME[n.type] || '').toUpperCase(), 16) : '?');
    return (
      <aside className="panel inspector" aria-label="Inspector">
        <header><h2>Connector</h2><span>{e.route}{bends ? ` · ${bends} ${bends === 1 ? 'bend' : 'bends'}` : ''}</span></header>
        <section>
          <div className="caption">LABEL</div>
          <textarea rows={2} value={e.label} onChange={ev => set({ label: ev.target.value }, 'el' + id)} />
        </section>
        <section>
          <div className="from-to">{nm(nodeById[e.from])} → {nm(nodeById[e.to])}</div>
          <Seg label="ROUTE" opts={[['elbow', 'Elbow'], ['straight', 'Straight'], ['curve', 'Curve']]} value={e.route} onChange={v => set({ route: v })} />
          <Seg label="ARROW" opts={[['none', 'None'], ['end', 'End'], ['both', 'Both']]} value={e.arrow} onChange={v => set({ arrow: v })} />
          <Seg label="LINE" opts={SOLID} value={!!e.dashed} onChange={v => set({ dashed: v })} />
          <Seg label="FROM" opts={SIDE_OPTS} value={e.fromSide || 'auto'} onChange={v => act.sides({ fromSide: v })} />
          <Seg label="TO" opts={SIDE_OPTS} value={e.toSide || 'auto'} onChange={v => act.sides({ toSide: v })} />
          <p className="hint tight">Drag the round handle on the line to add a bend. Double-click a square bend to remove it.</p>
        </section>
        <Acts list={[
          ['REVERSE DIRECTION', act.reverse, { wide: true }],
          bends > 0 && ['STRAIGHTEN', act.straighten, { wide: true, title: 'Remove all bends' }],
          ['DELETE', act.del, { danger: true, wide: true }]
        ]} />
      </aside>
    );
  }
  const count = nodes.length + edges.length;
  if (count < 2) return null;
  const groups = new Set(nodes.map(n => n.group).filter(Boolean)), oneGroup = groups.size === 1 && nodes.every(n => n.group);
  const allLocked = nodes.length > 0 && nodes.every(n => n.locked);
  return (
    <aside className="panel inspector" aria-label="Inspector">
      <header><h2>{oneGroup ? 'Group' : 'Selection'}</h2><span>{count} items</span></header>
      <section>
        <div className="caption">ALIGN</div>
        <div className="grid3">
          {['left', 'center', 'right', 'top', 'middle', 'bottom'].map(k => (
            <button type="button" key={k} className="act small" disabled={nodes.length < 2} onClick={() => act.align(k)}>{k.toUpperCase()}</button>
          ))}
        </div>
        <div className="grid2">
          <button type="button" className="act small" disabled={nodes.length < 3} title="Space three or more shapes evenly from left to right" onClick={() => act.distribute('x')}>SPACE ACROSS</button>
          <button type="button" className="act small" disabled={nodes.length < 3} title="Space three or more shapes evenly from top to bottom" onClick={() => act.distribute('y')}>SPACE DOWN</button>
        </div>
      </section>
      <Acts list={[
        nodes.length > 1 && !oneGroup && ['GROUP', act.group, { title: `Group the shapes (${MOD}G)` }],
        groups.size > 0 && ['UNGROUP', act.ungroup, { title: `Ungroup the shapes (${KSHIFT}${MOD}G)` }],
        nodes.length > 0 && [allLocked ? 'UNLOCK' : 'LOCK', act.lock, { title: `${allLocked ? 'Unlock' : 'Lock'} the shapes (${KSHIFT}${MOD}L)` }],
        nodes.some(n => TURN[n.type]) && ['ROTATE 90°', act.rotate, { title: 'Rotate the doors and furniture 90° (⇧R)' }],
        nodes.some(n => TURN[n.type]) && ['FLIP', act.flip, { title: 'Mirror the doors and furniture (⇧H)' }],
        nodes.length > 0 && ['WRAP IN ZONE', act.wrap, { title: `Draw a zone around the shapes (${ALT}${MOD}G)` }],
        nodes.length > 0 && ['DUPLICATE', act.dup],
        ['DELETE', act.del, { danger: true }]
      ]} />
    </aside>
  );
}

const KEYMAP = [
  ['V', 'Select'], ['H · Space', 'Pan'], ['C', 'Connector'], ['P · L', 'Pen · line / wall'],
  ['B R D Q', 'Box · service · database · queue'], ['U G', 'Actor · zone'], ['K E', 'Decision · terminal'],
  ['W O I M', 'Window · button · input · image'], ['N T', 'Note · text'], ['Enter', 'Edit label'],
  ['Double-click', 'Edit label · new text'], ['Esc', 'Cancel · clear selection'],
  [`${MOD}Z · ${MOD}${KSHIFT}Z`, 'Undo · redo'], [`${MOD}C · X · V`, 'Copy · cut · paste'],
  [`${MOD}D`, 'Duplicate'], [`${MOD}A`, 'Select all'], [`${MOD}G · ${KSHIFT}${MOD}G`, 'Group · ungroup'],
  [`${ALT}${MOD}G`, 'Wrap selection in zone'], [`${KSHIFT}${MOD}L`, 'Lock · unlock'], [`${MOD}click`, 'Select one shape in a group'],
  ['Drag a connector', 'Add a bend · double-click a bend to remove it'],
  ['/', 'Library: shapes and cloud icons'], [`${KSHIFT}R · ${KSHIFT}H`, 'Rotate · flip doors and furniture'],
  [`${MOD}S`, 'Save now'], [`${MOD}O`, 'Open a JSON file'], ['?', 'Show this list'],
  ['Delete', 'Remove selection'], ['Arrows', 'Nudge · shift = one square'], ['Scroll', 'Pan'],
  [`${MOD}Scroll · + −`, 'Zoom'], [`${KSHIFT}1 · ${KSHIFT}0`, 'Fit · 100%'], ['Alt drag', 'Move without guides']
];

export function HelpPanel({ onClose }) {
  return (
    <aside className="panel float" aria-label="Keyboard shortcuts">
      <header><h2>KEYBOARD</h2><button type="button" className="close" onClick={onClose}>CLOSE</button></header>
      <div className="keys">
        {KEYMAP.map(([k, v]) => <div key={k} className="key-row"><span className="kbd">{k}</span><span>{v}</span></div>)}
      </div>
    </aside>
  );
}

export function SetupPanel({ settings, onSet, onClose }) {
  return (
    <aside className="panel float setup" aria-label="Drafting setup">
      <header><h2>DRAFTING SETUP</h2><button type="button" className="close" onClick={onClose}>CLOSE</button></header>
      <section>
        <Seg label="LETTERS" opts={[['hand', 'Hand'], ['technical', 'Technical']]} value={settings.lettering} onChange={v => onSet({ lettering: v })} />
        <Seg label="CAPITALS" opts={[[true, 'On'], [false, 'Off']]} value={settings.caps} onChange={v => onSet({ caps: v })} />
        <Seg label="GRID" opts={[[10, '10 px'], [20, '20 px'], [25, '25 px']]} value={settings.grid} onChange={v => onSet({ grid: v })} />
        <Seg label="ROUTE" opts={[['elbow', 'Elbow'], ['straight', 'Straight'], ['curve', 'Curve']]} value={settings.route} onChange={v => onSet({ route: v })} />
      </section>
      <p className="hint">These settings apply to the whole project and travel with the JSON file. Route sets the shape of new connectors. On a sheet drawn in FT or M, one grid square is 1 ft or 0.5 m.</p>
    </aside>
  );
}

// A small drawing of a template sheet. Cloud icons appear when their set has loaded.
function TemplatePreview({ sheet, ctx }) {
  const b = bounds(sheet.nodes) || { x: 0, y: 0, w: 100, h: 60 }, pad = 30;
  const map = Object.fromEntries(sheet.nodes.map(n => [n.id, n]));
  const c = { ...ctx, unit: sheet.unit };
  return (
    <svg className="tpreview" viewBox={`${b.x - pad} ${b.y - pad} ${b.w + 2 * pad} ${b.h + 2 * pad}`} preserveAspectRatio="xMidYMid meet" aria-hidden="true">
      {sheet.nodes.filter(n => n.type === 'zone').map(n => renderNode(n, c))}
      {sheet.edges.map(e => renderEdge(e, map, c, false))}
      {sheet.nodes.filter(n => n.type !== 'zone').map(n => renderNode(n, c))}
    </svg>
  );
}

export const NewPanel = memo(function NewPanel({ theme, letter, caps, grid, on }) {
  const [, setGen] = useState(0);
  const sheets = useMemo(() => Object.fromEntries(TEMPLATES.map(tp => [tp.id, tp.sheet()])), []);
  useEffect(() => onCloudLoad(() => setGen(g => g + 1)), []);
  useEffect(() => { [...new Set(TEMPLATES.flatMap(tp => tp.clouds))].forEach(id => loadCloud(id).catch(() => {})); }, []);
  const ctx = { t: theme, L: letter, caps, g: grid };
  return (
    <aside className="panel float new-panel" aria-label="New">
      <header><h2>NEW</h2><button type="button" className="close" onClick={on.close}>CLOSE</button></header>
      <div className="new-body">
        <div className="caption">START</div>
        <div className="grid2">
          <button type="button" className="act" onClick={on.blankSheet}>BLANK SHEET</button>
          <button type="button" className="act" onClick={on.blankDoc}>BLANK PROJECT</button>
        </div>
        <p className="hint tight">A blank sheet joins this project. A blank project replaces this project, and the message after it has an UNDO button.</p>
        <div className="caption">TEMPLATES · EACH ONE ADDS A SHEET</div>
        <div className="templates">
          {TEMPLATES.map(tp => (
            <button type="button" className="template" key={tp.id} onClick={() => on.add(tp.id)}>
              <TemplatePreview sheet={sheets[tp.id]} ctx={ctx} />
              <span className="tname">{tp.name}</span>
              <span className="tdesc">{tp.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
});

export function SharePanel({ share, on }) {
  const ref = useRef(null);
  const url = share && share.url, kb = url ? Math.max(1, Math.round(url.length / 1024)) : 0;
  const copy = () => {
    if (!url) return;
    const fail = () => { if (ref.current) { ref.current.focus(); ref.current.select(); } on.copied(false); };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url).then(() => on.copied(true), fail);
    else fail();
  };
  return (
    <aside className="panel float share-panel" aria-label="Share">
      <header><h2>SHARE</h2><button type="button" className="close" onClick={on.close}>CLOSE</button></header>
      <section>
        <div className="caption">LINK TO THIS PROJECT</div>
        {share && share.error ? (
          <p className="hint tight">This browser could not make the link. Use Export JSON, and send the file.</p>
        ) : (
          <div className="share-row">
            <input ref={ref} className="field" readOnly value={url || 'Making the link…'} onFocus={e => e.target.select()} aria-label="Share link" />
            <button type="button" className="act" disabled={!url} onClick={copy}>COPY</button>
          </div>
        )}
        <p className="hint tight">
          The link holds the whole project, so no server stores it. Anyone with the link can open a copy. Changes that you make after you copy the link are not in it.
          {url ? ` The link is ${kb} KB long.` : ''}
          {url && url.length > 60000 ? ' Some chat apps cut long links. If the link does not open, send the JSON file.' : ''}
        </p>
      </section>
    </aside>
  );
}

export function IncomingPanel({ doc, on }) {
  const n = doc.sheets.length, name = doc.meta.project || 'an untitled project';
  return (
    <aside className="panel float incoming" aria-label="Shared project">
      <header><h2>SHARED PROJECT</h2></header>
      <section>
        <p className="lead">The link holds {name}, with {n} {n === 1 ? 'sheet' : 'sheets'}. Your own project stays unless you replace it.</p>
        <button type="button" className="act" onClick={on.add}>ADD ITS SHEETS TO MY PROJECT</button>
        <button type="button" className="act" onClick={on.replace}>REPLACE MY PROJECT</button>
        <button type="button" className="act" onClick={on.cancel}>CANCEL</button>
      </section>
    </aside>
  );
}

export function TitleBlock({ wide, tb }) {
  const field = (cls, label, value, onChange, placeholder) => (
    <div className={cx('cell', cls)}>
      <div className="caption">{label}</div>
      <input value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} aria-label={label} spellCheck={false} />
    </div>
  );
  if (!wide) {
    return (
      <div className="title-block narrow">
        <div className="caption">{tb.num} · {tb.sheetOf}</div>
        <input value={tb.name} onChange={e => tb.setName(e.target.value)} aria-label="Sheet title" spellCheck={false} />
      </div>
    );
  }
  return (
    <div className="title-block">
      {field('project span2 br bb', 'PROJECT', tb.project, tb.setProject, 'Project name')}
      {field('mono br bb', 'DWG NO', tb.num, tb.setNum)}
      {field('mono bb', 'REV', tb.rev, tb.setRev)}
      {field('title span2 br bb', 'TITLE', tb.name, tb.setName, 'Sheet title')}
      <button type="button" className="cell scale br bb" title="Change the drawing units of this sheet" onClick={tb.cycleUnit}>
        <span className="caption">SCALE ↻</span>
        <span className="value">{tb.scale}</span>
      </button>
      <div className="cell bb">
        <div className="caption">SHEET</div>
        <div className="value">{tb.sheetOf}</div>
      </div>
      {field('drawn br', 'DRAWN BY', tb.drawn, tb.setDrawn, 'Initials')}
      {field('mono small br', 'DATE', tb.date, tb.setDate)}
      <div className="cell span2 maker"><div className="mark small"><div /></div><span>FERROPRINT</span></div>
    </div>
  );
}

export function StatusBar({ right, cursor, zoomPct, tool, hint, tabs, delLabel, on }) {
  return (
    <div className="bottom-left" style={{ right }}>
      <div className="status">
        <div className="coords">X {cursor.x} · Y {cursor.y}</div>
        <button type="button" className="zbtn sep" title="Zoom out (−)" aria-label="Zoom out" onClick={on.zoomOut}>−</button>
        <button type="button" className="zbtn pct" title={`Zoom to 100% (${SHIFT}0)`} onClick={on.zoom100}>{zoomPct}</button>
        <button type="button" className="zbtn" title="Zoom in (+)" aria-label="Zoom in" onClick={on.zoomIn}>+</button>
        <button type="button" className="zbtn sep fit" title={`Fit drawing (${SHIFT}1)`} onClick={on.fit}>FIT</button>
        <div className="tool-hint"><span className="accent">{tool}</span><span className="muted">{hint}</span></div>
      </div>
      <div className="tabs" role="tablist" aria-label="Sheets">
        {tabs.map(t => (
          <button type="button" role="tab" key={t.id} aria-selected={t.active} className={cx('tab', t.active && 'on')} title={t.full} onClick={t.on}>
            <span className="tab-num">{t.num}</span><span className="tab-name">{t.name}</span>
          </button>
        ))}
        <button type="button" className="tab-btn" title="Add a sheet" onClick={on.addSheet}>+ SHEET</button>
        {tabs.length > 1 && <button type="button" className="tab-btn danger" title="Delete the current sheet" onClick={on.delSheet}>{delLabel}</button>}
      </div>
    </div>
  );
}

export function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div className={cx('toast', toast.action && 'has-action')} role="status">
      <span>{toast.msg}</span>
      {toast.action && <button type="button" onClick={toast.action.run}>{toast.action.label}</button>}
    </div>
  );
}

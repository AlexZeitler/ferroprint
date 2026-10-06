// Editor chrome: the sheet frame, toolbars, inspector, panels, title block and status bar.
import { useRef, useState } from 'react';
import { TYPE_NAME, TOOL_NAMES, KEY_OF, LABELLESS, NOFILL, trunc } from './engine.js';
import { ICONS, PALETTE } from './icons.jsx';

const IS_MAC = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const MOD = IS_MAC ? '⌘' : 'Ctrl ';
const SHIFT = IS_MAC ? '⇧' : 'Shift ';
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
function NumField({ label, value, onCommit }) {
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
      <input type="text" inputMode="decimal" spellCheck={false} value={draft ?? String(value)} onChange={e => setDraft(e.target.value)} onBlur={commit} onKeyDown={onKeyDown} />
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
        <Btn title="Start a new, empty project" onClick={on.newDoc}>New</Btn>
        <Btn title={`Open a Ferroprint JSON file (${MOD}O)`} onClick={on.open}>Open</Btn>
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

export function Palette({ tool, onTool }) {
  return (
    <nav className="palette" aria-label="Tools">
      {PALETTE.map(g => (
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
      ))}
    </nav>
  );
}

const SOLID = [[false, 'Solid'], [true, 'Dashed']];

export function Inspector({ nodes, edges, nodeById, fmt, setNode, setEdge, act }) {
  if (nodes.length === 1 && !edges.length) {
    const n = nodes[0], id = n.id;
    const set = (patch, key) => setNode(id, patch, key);
    return (
      <aside className="panel inspector" aria-label="Inspector">
        <header><h2>{TYPE_NAME[n.type] || n.type}</h2><span>{fmt(n.w)} × {fmt(n.h)}</span></header>
        {!LABELLESS[n.type] && (
          <section>
            <div className="caption">LABEL</div>
            <textarea rows={2} value={n.label} onChange={e => set({ label: e.target.value }, 'label' + id)} />
            <div className="caption">DETAIL</div>
            <input className="field mono" value={n.sub} placeholder={n.type === 'room' ? 'Area is shown automatically' : 'e.g. Postgres 16'} onChange={e => set({ sub: e.target.value }, 'sub' + id)} />
          </section>
        )}
        <section>
          <div className="caption">POSITION · SIZE (PX)</div>
          <div className="geom">
            {['x', 'y', 'w', 'h'].map(f => (
              <NumField key={id + f} label={f.toUpperCase()} value={Math.round(n[f])} onCommit={v => set({ [f]: f === 'w' || f === 'h' ? Math.max(1, v) : v }, 'geo' + f + id)} />
            ))}
          </div>
        </section>
        <section>
          <Seg label="LINE" opts={SOLID} value={!!n.dashed} onChange={v => set({ dashed: v })} />
          {!NOFILL[n.type] && <Seg label="FILL" opts={[['none', 'None'], ['tint', 'Tint'], ['hatch', 'Hatch']]} value={n.fill || 'none'} onChange={v => set({ fill: v })} />}
          {!LABELLESS[n.type] && <Seg label="TEXT" opts={[['s', 'S'], ['m', 'M'], ['l', 'L']]} value={n.size || 'm'} onChange={v => set({ size: v })} />}
          {(n.type === 'path' || n.type === 'line') && <Seg label="WEIGHT" opts={[['s', 'Fine'], ['m', 'Medium'], ['l', 'Wall']]} value={n.weight || 'm'} onChange={v => set({ weight: v })} />}
        </section>
        <footer>
          <button type="button" className="act" onClick={act.front}>TO FRONT</button>
          <button type="button" className="act" onClick={act.back}>TO BACK</button>
          {n.type === 'door' && <button type="button" className="act wide" onClick={act.flip}>FLIP SWING</button>}
          <button type="button" className="act" onClick={act.dup}>DUPLICATE</button>
          <button type="button" className="act danger" onClick={act.del}>DELETE</button>
        </footer>
      </aside>
    );
  }
  if (edges.length === 1 && !nodes.length) {
    const e = edges[0], id = e.id;
    const set = (patch, key) => setEdge(id, patch, key);
    const nm = n => (n ? trunc(String(n.label || TYPE_NAME[n.type] || '').toUpperCase(), 16) : '?');
    return (
      <aside className="panel inspector" aria-label="Inspector">
        <header><h2>Connector</h2><span>{e.route}</span></header>
        <section>
          <div className="caption">LABEL</div>
          <textarea rows={2} value={e.label} onChange={ev => set({ label: ev.target.value }, 'el' + id)} />
        </section>
        <section>
          <div className="from-to">{nm(nodeById[e.from])} → {nm(nodeById[e.to])}</div>
          <Seg label="ROUTE" opts={[['elbow', 'Elbow'], ['straight', 'Straight'], ['curve', 'Curve']]} value={e.route} onChange={v => set({ route: v })} />
          <Seg label="ARROW" opts={[['none', 'None'], ['end', 'End'], ['both', 'Both']]} value={e.arrow} onChange={v => set({ arrow: v })} />
          <Seg label="LINE" opts={SOLID} value={!!e.dashed} onChange={v => set({ dashed: v })} />
        </section>
        <footer>
          <button type="button" className="act wide" onClick={act.reverse}>REVERSE DIRECTION</button>
          <button type="button" className="act danger wide" onClick={act.del}>DELETE</button>
        </footer>
      </aside>
    );
  }
  const count = nodes.length + edges.length;
  if (count < 2) return null;
  return (
    <aside className="panel inspector" aria-label="Inspector">
      <header><h2>Selection</h2><span>{count} items</span></header>
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
      <footer>
        {nodes.length > 0 && <button type="button" className="act wide" onClick={act.wrap}>WRAP IN ZONE</button>}
        {nodes.length > 0 && <button type="button" className="act" onClick={act.dup}>DUPLICATE</button>}
        <button type="button" className={cx('act danger', !nodes.length && 'wide')} onClick={act.del}>DELETE</button>
      </footer>
    </aside>
  );
}

const KEYMAP = [
  ['V', 'Select'], ['H · Space', 'Pan'], ['C', 'Connector'], ['P · L', 'Pen · line / wall'],
  ['B R D Q', 'Box · service · database · queue'], ['U G', 'Actor · zone'], ['K E', 'Decision · terminal'],
  ['W O I M', 'Window · button · input · image'], ['N T', 'Note · text'], ['Enter', 'Edit label'],
  ['Double-click', 'Edit label · new text'], ['Esc', 'Cancel · clear selection'],
  [`${MOD}Z · ${MOD}${KSHIFT}Z`, 'Undo · redo'], [`${MOD}C · X · V`, 'Copy · cut · paste'],
  [`${MOD}D`, 'Duplicate'], [`${MOD}A`, 'Select all'], [`${MOD}G`, 'Wrap selection in zone'],
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

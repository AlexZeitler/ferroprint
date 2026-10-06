import { Component, createRef } from 'react';
import { flushSync } from 'react-dom';
import * as F from './engine.js';
import { renderNode, renderEdge, renderDims } from './draw.jsx';
import { SYMBOLS } from './library.jsx';
import { Frame, TopBar, Palette, Inspector, HelpPanel, SetupPanel, LibraryPanel, TitleBlock, StatusBar, Toast } from './chrome.jsx';
import { DOC_KEY, loadDoc, parseDoc, saveDoc, loadUI, saveUI, storageAvailable } from './storage.js';

const SAVE_DELAY = 400;
const HISTORY_LIMIT = 150;
const RECENT_MAX = 3;
const PALETTE_TOOLS = new Set(['door']);

function textureFor(mode) {
  const [r, g, b] = F.THEMES[mode].tex;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='220' height='220'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/><feColorMatrix type='matrix' values='0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} 0 0 0 0.55 -0.22'/></filter><rect width='100%' height='100%' filter='url(#n)'/></svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
}
const TEXTURES = { blue: textureFor('blue'), white: textureFor('white') };

export default class Editor extends Component {
  constructor(props) {
    super(props);
    const stored = loadDoc(), ui = loadUI();
    this.state = {
      doc: stored ? stored.doc : F.exampleDoc(),
      tool: 'select', sel: [], hover: null, editing: null, marquee: null, guides: [], temp: null, draft: null,
      snap: ui.snap !== false, dims: ui.dims !== false, mode: ui.mode === 'white' ? 'white' : 'blue',
      recent: Array.isArray(ui.recent) ? ui.recent.filter(id => SYMBOLS[id]).slice(0, RECENT_MAX) : ['stairs', 'sofa', 'cloud'], ghost: null,
      size: { w: 0, h: 0 }, cursor: { x: 0, y: 0 }, space: false, panning: false,
      panel: null, toast: null, delArm: false, palTop: 92,
      win: { w: window.innerWidth, h: window.innerHeight },
      save: storageAvailable() ? 'saved' : 'off'
    };
    this._savedJSON = stored ? stored.json : null;
    this.undoStack = []; this.redoStack = [];
    this.drag = null; this.clip = null; this.pasteN = 0;
    this.pointers = new Map();
    this.fontCache = {}; this.fontGen = 0;
    this.nodeCache = new WeakMap(); this.edgeCache = new WeakMap();
    this.barRef = createRef(); this.fileRef = createRef();
    this.canvasEl = null; this.contentEl = null;
    ['onDown', 'onMove', 'onUp', 'onDbl', 'onWheel', 'onKey', 'onKeyUp', 'onResize', 'setCanvas', 'setContent', 'onFile', 'onBlurWin', 'onStorage', 'onHide'].forEach(k => { this[k] = this[k].bind(this); });
  }

  componentDidMount() {
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('resize', this.onResize);
    window.addEventListener('blur', this.onBlurWin);
    window.addEventListener('storage', this.onStorage);
    window.addEventListener('pagehide', this.onHide);
    document.addEventListener('visibilitychange', this.onHide);
    this.persist();
    if (document.fonts) {
      // Labels are measured on a canvas, so redraw once the drafting fonts are ready.
      Promise.all(['500 16px "Barlow Condensed"', '400 16px "Architects Daughter"', '400 12px "IBM Plex Mono"'].map(f => document.fonts.load(f).catch(() => null)))
        .then(() => { this.fontGen++; this.forceUpdate(); });
    }
  }
  componentWillUnmount() {
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('resize', this.onResize);
    window.removeEventListener('blur', this.onBlurWin);
    window.removeEventListener('storage', this.onStorage);
    window.removeEventListener('pagehide', this.onHide);
    document.removeEventListener('visibilitychange', this.onHide);
    if (this._saveT) this.flushSave();
    [this._toastT, this._armT].forEach(clearTimeout);
  }
  componentDidUpdate() { this.persist(); }

  // ---------- persistence
  persist() {
    const st = this.state;
    if (this._mode !== st.mode) { this._mode = st.mode; this.applyTheme(); }
    if (this._doc !== st.doc) { this._doc = st.doc; this.scheduleSave(); }
    const prefs = { snap: st.snap, dims: st.dims, mode: st.mode, recent: st.recent }, ui = JSON.stringify(prefs);
    if (ui !== this._ui) { this._ui = ui; saveUI(prefs); }
    if (!this.sheet().view && this.canvasEl && this.canvasEl.getBoundingClientRect().width > 0) this.fit();
    const bar = this.barRef.current;
    if (bar) {
      const h = bar.offsetHeight;
      if (h && h !== this._topH) { this._topH = h; this.setState({ palTop: 40 + h + 12 }); }
    }
  }
  scheduleSave() {
    if (this.state.save === 'off') return;
    clearTimeout(this._saveT);
    this._saveT = setTimeout(() => this.flushSave(), SAVE_DELAY);
    if (this.state.save === 'saved') this.setState({ save: 'pending' });
  }
  flushSave() {
    clearTimeout(this._saveT); this._saveT = null;
    if (this.state.save === 'off') return false;
    const json = JSON.stringify(this.state.doc);
    const ok = json === this._savedJSON || saveDoc(json);
    if (ok) { this._savedJSON = json; this._warned = false; }
    const save = ok ? 'saved' : 'error';
    if (this.state.save !== save) this.setState({ save });
    if (!ok && !this._warned) { this._warned = true; this.flash('Could not save. Browser storage is full. Export JSON to keep your work.', 7000); }
    return ok;
  }
  saveNow() {
    if (this.state.save === 'off') { this.flash('This browser blocks local storage. Use Export JSON to keep your work.', 5000); return; }
    if (this.flushSave()) this.flash('Saved in this browser');
  }
  onHide(e) {
    if (e.type === 'visibilitychange' && document.visibilityState !== 'hidden') return;
    if (this._saveT) this.flushSave();
  }
  // Another tab saved the project. Take its content, but keep this tab's sheet and view.
  onStorage(e) {
    if (e.key !== DOC_KEY || e.newValue == null || e.newValue === this._savedJSON) return;
    const parsed = parseDoc(e.newValue);
    if (!parsed) return;
    const cur = this.state.doc, inc = parsed.doc, local = new Map(cur.sheets.map(s => [s.id, s]));
    const doc = {
      ...inc,
      active: inc.sheets.some(s => s.id === cur.active) ? cur.active : inc.active,
      sheets: inc.sheets.map(s => (local.has(s.id) ? { ...s, view: local.get(s.id).view } : s))
    };
    clearTimeout(this._saveT); this._saveT = null;
    this._savedJSON = e.newValue; this._doc = doc;
    this.undoStack = []; this.redoStack = []; this.drag = null;
    const act = doc.sheets.find(s => s.id === doc.active), ids = new Set([...act.nodes.map(n => n.id), ...act.edges.map(x => x.id)]);
    const ed = this.state.editing;
    this.setState({ doc, sel: this.state.sel.filter(id => ids.has(id)), editing: ed && ids.has(ed.id) ? ed : null, hover: null, temp: null, draft: null, marquee: null, guides: [], panning: false, save: 'saved' });
  }
  applyTheme() {
    const t = F.THEMES[this.state.mode];
    document.body.style.background = t.paper;
    document.documentElement.style.colorScheme = this.state.mode === 'blue' ? 'dark' : 'light';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t.paper);
  }

  // ---------- accessors
  sheet() { const d = this.state.doc; return d.sheets.find(s => s.id === d.active) || d.sheets[0]; }
  g() { return this.state.doc.settings.grid; }
  letter() { return this.state.doc.settings.lettering === 'technical' ? F.LETTER.technical : F.LETTER.hand; }
  defRoute() { return this.state.doc.settings.route; }
  drawCtx(s) { return { t: F.THEMES[this.state.mode], L: this.letter(), caps: this.state.doc.settings.caps, unit: s.unit, g: this.g() }; }
  measure() { const r = this.canvasEl ? this.canvasEl.getBoundingClientRect() : null; return r && r.width ? { w: r.width, h: r.height } : this.state.size; }
  view() { return this.sheet().view || this.fitView() || { x: 160, y: 120, k: 1 }; }
  fitView() {
    const s = this.sheet(), { w, h: H } = this.measure();
    if (!w) return null;
    const b = F.bounds(s.nodes), L = 140, R = 60, T = 80, B = 160, aw = Math.max(100, w - L - R), ah = Math.max(100, H - T - B);
    if (!b) return { x: L + 40, y: T + 40, k: 1 };
    const k = F.clamp(Math.min(aw / b.w, ah / b.h), 0.2, 1.25);
    return { k, x: L + aw / 2 - (b.x + b.w / 2) * k, y: T + ah / 2 - (b.y + b.h / 2) * k };
  }
  sn(v) { const g = this.g(); return this.state.snap ? Math.round(v / g) * g : Math.round(v); }
  updSheet(fn, cb) { this.setState(st => { const d = st.doc; return { doc: { ...d, sheets: d.sheets.map(s => (s.id === d.active ? { ...s, ...fn(s) } : s)) } }; }, cb); }
  setView(v) { this.updSheet(() => ({ view: v })); }
  setNodes(fn) { this.updSheet(s => ({ nodes: fn(s.nodes) })); }
  setEdges(fn) { this.updSheet(s => ({ edges: fn(s.edges) })); }
  setMeta(key, val) { this.setState(st => ({ doc: { ...st.doc, meta: { ...st.doc.meta, [key]: val } } })); }
  setSettings(patch) { this.setState(st => ({ doc: { ...st.doc, settings: { ...st.doc.settings, ...patch } } })); }
  nodeMap(s) { const m = {}; s.nodes.forEach(n => { m[n.id] = n; }); return m; }
  toWorld(cx, cy) { const r = this.canvasEl ? this.canvasEl.getBoundingClientRect() : { left: 0, top: 0 }, v = this.view(); return { x: (cx - r.left - v.x) / v.k, y: (cy - r.top - v.y) / v.k }; }

  // ---------- history: snapshots of the active sheet's shapes and connectors
  pushHistory(key) {
    const now = Date.now();
    if (key && key === this.hKey && now - this.hT < 1200) { this.hT = now; return; }
    this.hKey = key; this.hT = now;
    const s = this.sheet();
    this.undoStack.push(JSON.stringify({ nodes: s.nodes, edges: s.edges }));
    if (this.undoStack.length > HISTORY_LIMIT) this.undoStack.shift();
    this.redoStack = [];
  }
  stepHistory(from, to) {
    if (!from.length) return;
    const s = this.sheet();
    to.push(JSON.stringify({ nodes: s.nodes, edges: s.edges }));
    const p = JSON.parse(from.pop());
    this.hKey = null;
    this.updSheet(() => p);
    this.setState({ sel: [], editing: null });
  }
  doUndo() { this.stepHistory(this.undoStack, this.redoStack); }
  doRedo() { this.stepHistory(this.redoStack, this.undoStack); }

  // ---------- view
  fit() { const v = this.fitView(); if (v) this.setView(v); }
  zoomAt(f, sx, sy) { const v = this.view(), k = F.clamp(v.k * f, 0.15, 4), r = k / v.k; this.setView({ k, x: sx - (sx - v.x) * r, y: sy - (sy - v.y) * r }); }
  zoomCenter(f) { const { w, h } = this.measure(); this.zoomAt(f, w / 2, h / 2); }

  setCanvas(el) {
    if (el === this.canvasEl) return;
    if (this.canvasEl) this.canvasEl.removeEventListener('wheel', this.onWheel);
    if (this.ro) { this.ro.disconnect(); this.ro = null; }
    this.canvasEl = el;
    if (el) {
      el.addEventListener('wheel', this.onWheel, { passive: false });
      this.ro = new ResizeObserver(() => { const r = el.getBoundingClientRect(); this.setState({ size: { w: r.width, h: r.height } }); });
      this.ro.observe(el);
    }
  }
  setContent(el) { this.contentEl = el; }
  onWheel(e) {
    e.preventDefault();
    const r = this.canvasEl.getBoundingClientRect(), sx = e.clientX - r.left, sy = e.clientY - r.top;
    const m = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? r.height : 1, dx = e.deltaX * m, dy = e.deltaY * m;
    if (e.ctrlKey || e.metaKey) this.zoomAt(Math.exp(-F.clamp(dy, -25, 25) * 0.01), sx, sy);
    else { const v = this.view(); this.setView({ ...v, x: v.x - (e.shiftKey && !dx ? dy : dx), y: v.y - (e.shiftKey && !dx ? 0 : dy) }); }
  }
  onResize() { this.setState({ win: { w: window.innerWidth, h: window.innerHeight } }); }
  onBlurWin() { if (this.state.space) this.setState({ space: false }); }

  hoverAt(p, exclude, tight) {
    const s = this.sheet(), k = this.view().k, pad = (tight ? 4 : 22) / k, ns = s.nodes;
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i];
      if (n.type === 'zone' || n.id === exclude) continue;
      const b = F.hitBox(n);
      if (p.x >= b.x - pad && p.x <= b.x + b.w + pad && p.y >= b.y - pad && p.y <= b.y + b.h + pad) return n.id;
    }
    // A zone is only a target near its border, so shapes inside it stay reachable.
    for (let i = ns.length - 1; i >= 0; i--) {
      const n = ns[i];
      if (n.type !== 'zone' || n.id === exclude) continue;
      const bp = 10 / k;
      const out = p.x >= n.x - pad && p.x <= n.x + n.w + pad && p.y >= n.y - pad && p.y <= n.y + n.h + pad;
      const inn = p.x > n.x + bp && p.x < n.x + n.w - bp && p.y > n.y + 28 && p.y < n.y + n.h - bp;
      if (out && !inn) return n.id;
    }
    return null;
  }

  // ---------- pointer
  onDown(e) {
    if (e.button === 2) return;
    if (e.pointerType === 'touch') {
      // Stop the emulated mouse events, so a tap cannot focus a panel that opens under the finger.
      e.preventDefault();
      if (e.isPrimary) { this.pointers.clear(); this._tap = { x: e.clientX, y: e.clientY, t: Date.now() }; }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) { this.startPinch(); return; }
      if (this.pointers.size > 2) return;
    }
    const ae = document.activeElement;
    if (ae && ae !== document.body && !this.canvasEl.contains(ae)) ae.blur();
    if (this.state.editing) this.commitEdit();
    if (this.state.delArm) this.setState({ delArm: false });
    const p = this.toWorld(e.clientX, e.clientY);
    const tg = e.target && e.target.closest ? e.target.closest('[data-k]') : null;
    const kind = tg ? tg.getAttribute('data-k') : null, id = tg ? tg.getAttribute('data-id') : null;
    const { tool, space } = this.state;
    try { this.canvasEl.setPointerCapture(e.pointerId); } catch { /* the pointer is already gone */ }
    if (e.button === 1 || tool === 'hand' || space) { e.preventDefault(); this.drag = { type: 'pan', cx: e.clientX, cy: e.clientY, v0: this.view() }; this.setState({ panning: true }); return; }
    if (F.SHAPES[tool]) { this.drag = { type: 'create', shape: tool, start: p }; return; }
    if (tool === 'pen') { this.drag = { type: 'pen', pts: [p] }; this.setState({ sel: [] }); return; }
    if (tool === 'line') { this.drag = { type: 'line', start: { x: this.sn(p.x), y: this.sn(p.y) } }; this.setState({ sel: [] }); return; }
    if (kind === 'port' || tool === 'connector') {
      const from = kind === 'port' || kind === 'node' ? id : this.hoverAt(p, null, true);
      if (from) { this.drag = { type: 'connect', from }; this.setState({ temp: { from, p, target: null }, sel: [] }); }
      return;
    }
    if (kind === 'handle') {
      const n = this.sheet().nodes.find(q => q.id === id);
      if (!n) return;
      this.pushHistory(); this.drag = { type: 'resize', handle: tg.getAttribute('data-h'), orig: { ...n } };
      return;
    }
    if (kind === 'node') {
      let sel = this.state.sel;
      if (e.shiftKey) { sel = sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]; this.setState({ sel }); if (!sel.includes(id)) return; }
      else if (!sel.includes(id)) { sel = [id]; this.setState({ sel }); }
      this.startMove(p, sel);
      return;
    }
    if (kind === 'edge') {
      const sel = e.shiftKey ? (this.state.sel.includes(id) ? this.state.sel.filter(x => x !== id) : [...this.state.sel, id]) : [id];
      this.setState({ sel });
      return;
    }
    this.drag = { type: 'marquee', start: p, base: e.shiftKey ? this.state.sel : [] };
    if (!e.shiftKey) this.setState({ sel: [] });
  }
  // Two fingers on a touch screen pan and zoom the sheet. This cancels any drag the first finger began.
  startPinch() {
    const d = this.drag;
    if (d) this.setState({ temp: null, draft: null, marquee: null, guides: [] });
    const [a, b] = [...this.pointers.values()], r = this.canvasEl.getBoundingClientRect();
    this.drag = { type: 'pinch', d0: Math.max(10, Math.hypot(a.x - b.x, a.y - b.y)), m0: { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top }, v0: this.view() };
  }
  startMove(p, sel) {
    const s = this.sheet(), ids = new Set(sel), orig = {};
    s.nodes.forEach(n => { if (ids.has(n.id)) orig[n.id] = { x: n.x, y: n.y }; });
    // Moving a zone also moves the shapes inside it.
    s.nodes.filter(z => z.type === 'zone' && ids.has(z.id)).forEach(z => s.nodes.forEach(n => { if (n.id !== z.id && !orig[n.id] && F.within(n, z)) orig[n.id] = { x: n.x, y: n.y }; }));
    const moving = s.nodes.filter(n => orig[n.id]);
    if (!moving.length) return;
    this.drag = { type: 'move', start: p, orig, ob: F.plainBounds(moving), others: s.nodes.filter(n => !orig[n.id]).map(n => ({ x: n.x, y: n.y, w: n.w, h: n.h })), moved: false };
  }
  onMove(e) {
    if (this.pointers.has(e.pointerId)) this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    this._lastMove = e;
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this.processMove(this._lastMove); });
  }
  processMove(e) {
    if (!e || !this.canvasEl) return;
    const p = this.toWorld(e.clientX, e.clientY), d = this.drag, k = this.view().k;
    const st = { cursor: { x: Math.round(p.x), y: Math.round(p.y) } };
    if (!d) {
      const over = this.canvasEl.contains(e.target);
      const hv = over && (this.state.tool === 'select' || this.state.tool === 'connector') ? this.hoverAt(p) : null;
      if (hv !== this.state.hover) st.hover = hv;
      this.setState(st);
      return;
    }
    if (d.type === 'place') {
      if (!d.started && Math.hypot(e.clientX - d.sx, e.clientY - d.sy) > 5) d.started = true;
      if (d.started) st.ghost = this.canvasEl.contains(e.target) ? { shape: d.shape, p } : null;
      this.setState(st);
      return;
    }
    if (d.type === 'pinch') {
      if (this.pointers.size < 2) return;
      const [a, b] = [...this.pointers.values()], r = this.canvasEl.getBoundingClientRect(), v0 = d.v0;
      const m = { x: (a.x + b.x) / 2 - r.left, y: (a.y + b.y) / 2 - r.top };
      const kk = F.clamp(v0.k * Math.hypot(a.x - b.x, a.y - b.y) / d.d0, 0.15, 4), ratio = kk / v0.k;
      this.setView({ k: kk, x: m.x - (d.m0.x - v0.x) * ratio, y: m.y - (d.m0.y - v0.y) * ratio });
      return;
    }
    if (d.type === 'pan') {
      this.setView({ ...d.v0, x: d.v0.x + e.clientX - d.cx, y: d.v0.y + e.clientY - d.cy });
    } else if (d.type === 'create') {
      if (!d.id && Math.hypot(p.x - d.start.x, p.y - d.start.y) * k < 6) { this.setState(st); return; }
      const g = this.g();
      const x0 = this.sn(Math.min(d.start.x, p.x)), y0 = this.sn(Math.min(d.start.y, p.y));
      const x1 = this.sn(Math.max(d.start.x, p.x)), y1 = this.sn(Math.max(d.start.y, p.y));
      const r = { x: x0, y: y0, w: Math.max(g, x1 - x0), h: Math.max(g, y1 - y0) };
      if (!d.id) {
        this.pushHistory();
        const n = F.newNode(d.shape, r);
        d.id = n.id;
        this.setNodes(ns => (d.shape === 'zone' ? [n, ...ns] : [...ns, n]));
        st.sel = [n.id];
      } else {
        const id = d.id;
        this.setNodes(ns => ns.map(n => (n.id === id ? { ...n, ...r } : n)));
      }
    } else if (d.type === 'move') {
      let dx = p.x - d.start.x, dy = p.y - d.start.y;
      if (!d.moved) {
        if (Math.hypot(dx, dy) * k < 3) { this.setState(st); return; }
        d.moved = true; this.pushHistory();
      }
      // Smart guides: snap the moving bounds to the edges and centers of other shapes.
      const ob = d.ob, th = 6 / k, guides = [];
      let nx = ob.x + dx, ny = ob.y + dy, bx = null, by = null;
      if (!e.altKey) d.others.forEach(o => {
        [o.x, o.x + o.w / 2, o.x + o.w].forEach(ox => [nx, nx + ob.w / 2, nx + ob.w].forEach(mx => { const df = ox - mx; if (Math.abs(df) <= th && (!bx || Math.abs(df) < Math.abs(bx.df))) bx = { df, v: ox, o }; }));
        [o.y, o.y + o.h / 2, o.y + o.h].forEach(oy => [ny, ny + ob.h / 2, ny + ob.h].forEach(my => { const df = oy - my; if (Math.abs(df) <= th && (!by || Math.abs(df) < Math.abs(by.df))) by = { df, v: oy, o }; }));
      });
      nx = bx ? nx + bx.df : this.sn(nx);
      ny = by ? ny + by.df : this.sn(ny);
      if (bx) guides.push({ x1: bx.v, x2: bx.v, y1: Math.min(bx.o.y, ny) - 16, y2: Math.max(bx.o.y + bx.o.h, ny + ob.h) + 16 });
      if (by) guides.push({ y1: by.v, y2: by.v, x1: Math.min(by.o.x, nx) - 16, x2: Math.max(by.o.x + by.o.w, nx + ob.w) + 16 });
      dx = nx - ob.x; dy = ny - ob.y;
      const orig = d.orig;
      this.setNodes(ns => ns.map(n => (orig[n.id] ? { ...n, x: orig[n.id].x + dx, y: orig[n.id].y + dy } : n)));
      st.guides = guides;
    } else if (d.type === 'resize') {
      const o = d.orig, hd = d.handle, id = o.id;
      if (hd === 'p0' || hd === 'p1') {
        const a = F.linePts(o);
        let q = { x: this.sn(p.x), y: this.sn(p.y) };
        if (e.shiftKey) q = F.constrain(hd === 'p0' ? a[1] : a[0], q);
        const nn = F.pathFrom(hd === 'p0' ? [q, a[1]] : [a[0], q]);
        this.setNodes(ns => ns.map(n => (n.id === id ? { ...n, ...nn } : n)));
      } else {
        let x0 = o.x, y0 = o.y, x1 = o.x + o.w, y1 = o.y + o.h;
        const mn = o.type === 'path' ? 4 : 20;
        if (hd.includes('w')) x0 = Math.min(this.sn(p.x), x1 - mn);
        if (hd.includes('e')) x1 = Math.max(this.sn(p.x), x0 + mn);
        if (hd.includes('n')) y0 = Math.min(this.sn(p.y), y1 - mn);
        if (hd.includes('s')) y1 = Math.max(this.sn(p.y), y0 + mn);
        this.setNodes(ns => ns.map(n => (n.id === id ? { ...n, x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : n)));
      }
    } else if (d.type === 'connect') {
      st.temp = { from: d.from, p, target: this.hoverAt(p, d.from, true) };
    } else if (d.type === 'marquee') {
      const r = F.rectFrom(d.start, p), s = this.sheet();
      const ids = s.nodes.filter(n => (n.type === 'zone' ? F.within(n, r) : F.inter(r, F.hitBox(n)))).map(n => n.id);
      const set = new Set([...d.base, ...ids]);
      s.edges.forEach(ed => { if (ids.includes(ed.from) && ids.includes(ed.to)) set.add(ed.id); });
      st.sel = [...set]; st.marquee = r;
    } else if (d.type === 'pen') {
      const last = d.pts[d.pts.length - 1];
      if (Math.hypot(p.x - last.x, p.y - last.y) * k >= 2.5) { d.pts.push(p); st.draft = { kind: 'pen', pts: d.pts.slice() }; }
    } else if (d.type === 'line') {
      let q = { x: this.sn(p.x), y: this.sn(p.y) };
      if (e.shiftKey) q = F.constrain(d.start, q);
      d.end = q; st.draft = { kind: 'line', pts: [d.start, q] };
    }
    this.setState(st);
  }
  onUp(e) {
    const touch = this.pointers.delete(e.pointerId) && e.isPrimary;
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; this.processMove(this._lastMove); }
    const d = this.drag;
    if (d && d.type === 'pinch') { if (this.pointers.size < 2) this.drag = null; return; }
    this.drag = null;
    if (touch) this.detectDoubleTap(e);
    if (!d) return;
    const p = this.toWorld(e.clientX, e.clientY), st = {};
    if (d.type === 'place') {
      st.ghost = null;
      const over = document.elementFromPoint(e.clientX, e.clientY);
      if (d.started && e.type !== 'pointercancel' && over && this.canvasEl.contains(over)) {
        const n = F.newNode(d.shape, this.placeRect(d.shape, p));
        this.pushHistory();
        this.setNodes(ns => [...ns, n]);
        Object.assign(st, { sel: [n.id], tool: 'select', recent: this.withRecent(d.shape) });
      }
    } else if (d.type === 'pan') st.panning = false;
    else if (d.type === 'create') {
      if (!d.id) {
        // A click without a drag places the shape at its default size, centered on the pointer.
        this.pushHistory();
        const n = F.newNode(d.shape, this.placeRect(d.shape, d.start));
        d.id = n.id;
        this.setNodes(ns => (d.shape === 'zone' ? [n, ...ns] : [...ns, n]));
      }
      st.sel = [d.id]; st.tool = 'select';
      if (d.shape === 'text' || d.shape === 'note') st.editing = { kind: 'node', id: d.id, value: F.SHAPES[d.shape].label };
    } else if (d.type === 'connect') {
      const target = e.type === 'pointercancel' ? null : this.hoverAt(p, d.from, true);
      if (target) {
        this.pushHistory();
        const ed = { id: F.uid(), from: d.from, to: target, label: '', route: this.defRoute(), arrow: 'end', dashed: false };
        this.setEdges(es => [...es, ed]);
        st.sel = [ed.id];
      }
      st.temp = null; st.tool = 'select';
    } else if (d.type === 'move') st.guides = [];
    else if (d.type === 'marquee') st.marquee = null;
    else if (d.type === 'pen') {
      if (d.pts.length > 1) {
        this.pushHistory();
        const n = { id: F.uid(), type: 'path', ...F.pathFrom(d.pts), weight: 's', dashed: false, label: '', sub: '', fill: 'none', size: 'm', flip: false };
        this.setNodes(ns => [...ns, n]);
      }
      st.draft = null;
    } else if (d.type === 'line') {
      if (d.end && Math.hypot(d.end.x - d.start.x, d.end.y - d.start.y) > 2) {
        this.pushHistory();
        const n = { id: F.uid(), type: 'line', ...F.pathFrom([d.start, d.end]), weight: 'm', dashed: false, label: '', sub: '', fill: 'none', size: 'm', flip: false };
        this.setNodes(ns => [...ns, n]);
        st.sel = [n.id];
      }
      st.draft = null;
    }
    this.setState(st);
  }
  // Touch screens get double-tap from the tap timing, because emulated mouse events are off.
  detectDoubleTap(e) {
    const t = this._tap, now = Date.now();
    this._tap = null;
    if (!t || now - t.t > 300 || Math.hypot(e.clientX - t.x, e.clientY - t.y) > 10) { this._lastTap = null; return; }
    const last = this._lastTap;
    if (last && now - last.t < 400 && Math.hypot(e.clientX - last.x, e.clientY - last.y) < 24) {
      this._lastTap = null; this._touchDblAt = now;
      // Render the label editor inside the gesture, so mobile browsers open the keyboard.
      flushSync(() => this.handleDouble(document.elementFromPoint(e.clientX, e.clientY), e.clientX, e.clientY));
    } else this._lastTap = { x: e.clientX, y: e.clientY, t: now };
  }
  onDbl(e) {
    if (Date.now() - (this._touchDblAt || 0) < 700) return;
    this.handleDouble(e.target, e.clientX, e.clientY);
  }
  handleDouble(target, clientX, clientY) {
    if (this.state.tool !== 'select') return;
    const tg = target && target.closest ? target.closest('[data-k]') : null;
    const kind = tg ? tg.getAttribute('data-k') : null, id = tg ? tg.getAttribute('data-id') : null;
    if ((kind === 'node' || kind === 'handle') && id) {
      const n = this.sheet().nodes.find(q => q.id === id);
      if (n && !F.LABELLESS[n.type]) this.startEdit('node', id);
      return;
    }
    if (kind === 'edge') { this.startEdit('edge', id); return; }
    if (!kind) {
      if (!target || !this.canvasEl.contains(target)) return;
      const p = this.toWorld(clientX, clientY);
      this.pushHistory();
      const n = F.newNode('text', { x: this.sn(p.x - 80), y: this.sn(p.y - 20), w: 160, h: 40 });
      n.label = '';
      this.setNodes(a => [...a, n]);
      this.setState({ sel: [n.id], editing: { kind: 'node', id: n.id, value: '' } });
    }
  }

  // ---------- label editing
  startEdit(kind, id) {
    const s = this.sheet(), it = (kind === 'node' ? s.nodes : s.edges).find(q => q.id === id);
    if (it) this.setState({ editing: { kind, id, value: it.label || '' }, sel: [id] });
  }
  commitEdit() {
    const ed = this.state.editing;
    if (!ed || this._done === ed) return;
    this._done = ed;
    this.setState({ editing: null });
    const s = this.sheet();
    if (ed.kind === 'node') {
      const n = s.nodes.find(q => q.id === ed.id);
      if (!n) return;
      // An empty text label has no purpose, so it is removed.
      if (n.type === 'text' && !ed.value.trim()) { this.setNodes(a => a.filter(q => q.id !== n.id)); this.setState({ sel: [] }); return; }
      if (n.label !== ed.value) { this.pushHistory(); this.setNodes(a => a.map(q => (q.id === n.id ? { ...q, label: ed.value } : q))); }
    } else {
      const x = s.edges.find(q => q.id === ed.id);
      if (x && x.label !== ed.value) { this.pushHistory(); this.setEdges(a => a.map(q => (q.id === x.id ? { ...q, label: ed.value } : q))); }
    }
  }
  cancelEdit() {
    const ed = this.state.editing;
    if (!ed) return;
    this._done = ed;
    this.setState({ editing: null });
    const n = ed.kind === 'node' && this.sheet().nodes.find(q => q.id === ed.id);
    if (n && n.type === 'text' && !n.label) this.setNodes(a => a.filter(q => q.id !== n.id));
  }

  // ---------- commands
  del() {
    const ids = new Set(this.state.sel);
    if (!ids.size) return;
    this.pushHistory();
    this.updSheet(s => ({ nodes: s.nodes.filter(n => !ids.has(n.id)), edges: s.edges.filter(e => !ids.has(e.id) && !ids.has(e.from) && !ids.has(e.to)) }));
    this.setState({ sel: [] });
  }
  copy() {
    const s = this.sheet(), ids = new Set(this.state.sel), nodes = s.nodes.filter(n => ids.has(n.id));
    if (!nodes.length) return false;
    const nid = new Set(nodes.map(n => n.id));
    this.clip = JSON.parse(JSON.stringify({ nodes, edges: s.edges.filter(e => nid.has(e.from) && nid.has(e.to)) }));
    this.pasteN = 0;
    return true;
  }
  paste() {
    if (!this.clip) return;
    this.pasteN++;
    const off = this.g() * this.pasteN, map = {};
    const nodes = this.clip.nodes.map(n => { const id = F.uid(); map[n.id] = id; return { ...n, id, x: n.x + off, y: n.y + off }; });
    const edges = this.clip.edges.map(e => ({ ...e, id: F.uid(), from: map[e.from], to: map[e.to] }));
    this.pushHistory();
    this.updSheet(s => ({ nodes: [...s.nodes, ...nodes], edges: [...s.edges, ...edges] }));
    this.setState({ sel: [...nodes.map(n => n.id), ...edges.map(e => e.id)] });
  }
  duplicate() { if (this.copy()) this.paste(); }
  wrapZone() {
    const s = this.sheet(), ids = new Set(this.state.sel), ns = s.nodes.filter(n => ids.has(n.id));
    if (!ns.length) return;
    const b = F.bounds(ns), g = this.g();
    const z = F.newNode('zone', { x: this.sn(b.x - 2 * g), y: this.sn(b.y - 3 * g), w: 0, h: 0 });
    z.w = this.sn(b.x + b.w + 2 * g) - z.x; z.h = this.sn(b.y + b.h + 2 * g) - z.y;
    this.pushHistory();
    this.setNodes(a => [z, ...a]);
    this.setState({ sel: [z.id] });
  }
  align(kind) {
    const s = this.sheet(), ids = new Set(this.state.sel), ns = s.nodes.filter(n => ids.has(n.id));
    if (ns.length < 2) return;
    const b = F.plainBounds(ns);
    const fn = {
      left: () => ({ x: b.x }), center: n => ({ x: Math.round(b.x + b.w / 2 - n.w / 2) }), right: n => ({ x: b.x + b.w - n.w }),
      top: () => ({ y: b.y }), middle: n => ({ y: Math.round(b.y + b.h / 2 - n.h / 2) }), bottom: n => ({ y: b.y + b.h - n.h })
    }[kind];
    this.pushHistory();
    this.setNodes(a => a.map(n => (ids.has(n.id) ? { ...n, ...fn(n) } : n)));
  }
  distribute(axis) {
    const s = this.sheet(), ids = new Set(this.state.sel), ns = s.nodes.filter(n => ids.has(n.id));
    if (ns.length < 3) return;
    const P = axis === 'x' ? 'x' : 'y', S = axis === 'x' ? 'w' : 'h';
    const sorted = ns.slice().sort((a, b) => a[P] - b[P]);
    const span = sorted[sorted.length - 1][P] + sorted[sorted.length - 1][S] - sorted[0][P];
    const gap = (span - sorted.reduce((t, n) => t + n[S], 0)) / (sorted.length - 1);
    const pos = {};
    let cur = sorted[0][P];
    sorted.forEach(n => { pos[n.id] = Math.round(cur); cur += n[S] + gap; });
    this.pushHistory();
    this.setNodes(a => a.map(n => (pos[n.id] != null ? { ...n, [P]: pos[n.id] } : n)));
  }
  arrange(front) {
    const id = this.state.sel[0];
    if (!id) return;
    this.pushHistory();
    this.setNodes(a => { const n = a.find(q => q.id === id); if (!n) return a; const rest = a.filter(q => q.id !== id); return front ? [...rest, n] : [n, ...rest]; });
  }
  setTool(id) { this.setState({ tool: id, temp: null, hover: null }); }
  // The default box of a shape, centered on a point and snapped to the grid.
  placeRect(shape, p) { const sz = F.SHAPES[shape]; return { x: this.sn(p.x - sz.w / 2), y: this.sn(p.y - sz.h / 2), w: sz.w, h: sz.h }; }
  // The palette keeps the last library symbols at hand. Symbols that the palette always shows stay out of the list.
  withRecent(id) {
    const r = this.state.recent;
    return !SYMBOLS[id] || PALETTE_TOOLS.has(id) ? r : [id, ...r.filter(x => x !== id)].slice(0, RECENT_MAX);
  }
  pickSymbol(id) {
    this.setState(st => ({ tool: id, temp: null, hover: null, recent: this.withRecent(id), panel: st.win.w < 640 ? null : st.panel }));
  }
  // A drag from a library tile. A short move without a drop stays a click, which picks the tool.
  startPlace(id, e) { this.drag = { type: 'place', shape: id, sx: e.clientX, sy: e.clientY, started: false }; }
  turnSelection(fn) {
    const ids = new Set(this.state.sel), s = this.sheet();
    if (!s.nodes.some(n => ids.has(n.id) && F.TURN[n.type])) return;
    this.pushHistory();
    this.setNodes(a => a.map(n => (ids.has(n.id) && F.TURN[n.type] ? fn(n) : n)));
  }
  rotateSel() { this.turnSelection(F.rotateNode); }
  flipSel() { this.turnSelection(n => ({ ...n, flip: !n.flip })); }
  togglePanel(name) { this.setState(st => ({ panel: st.panel === name ? null : name })); }
  openFile() { if (this.fileRef.current) this.fileRef.current.click(); }

  onKey(e) {
    const tag = ((e.target && e.target.tagName) || '').toLowerCase();
    const typing = tag === 'input' || tag === 'textarea' || tag === 'select' || (e.target && e.target.isContentEditable);
    const mod = e.metaKey || e.ctrlKey, k = (e.key || '').toLowerCase();
    if (mod && !e.altKey && k === 's') { e.preventDefault(); if (typing) e.target.blur(); this.saveNow(); return; }
    if (mod && !e.altKey && k === 'o') { e.preventDefault(); this.openFile(); return; }
    if (typing) return;
    if (e.key === ' ') { e.preventDefault(); if (!this.state.space) this.setState({ space: true }); return; }
    if (mod) {
      if (k === 'z') { e.preventDefault(); if (e.shiftKey) this.doRedo(); else this.doUndo(); }
      else if (k === 'y') { e.preventDefault(); this.doRedo(); }
      else if (k === 'c') this.copy();
      else if (k === 'x') { if (this.copy()) this.del(); }
      else if (k === 'v') { e.preventDefault(); this.paste(); }
      else if (k === 'd') { e.preventDefault(); this.duplicate(); }
      else if (k === 'a') { e.preventDefault(); const s = this.sheet(); this.setState({ sel: [...s.nodes.map(n => n.id), ...s.edges.map(x => x.id)] }); }
      else if (k === 'g') { e.preventDefault(); this.wrapZone(); }
      return;
    }
    if (k === 'delete' || k === 'backspace') { if (this.state.sel.length) { e.preventDefault(); this.del(); } return; }
    if (k === 'escape') {
      this.drag = null;
      this.setState({ sel: [], tool: 'select', panel: null, temp: null, draft: null, marquee: null, guides: [], ghost: null, panning: false, delArm: false });
      return;
    }
    if (e.key === '?') { this.togglePanel('help'); return; }
    if (e.key === '/') { e.preventDefault(); this.setState({ panel: 'library' }); return; }
    if (e.shiftKey && !e.altKey && k === 'r') { this.rotateSel(); return; }
    if (e.shiftKey && !e.altKey && k === 'h') { this.flipSel(); return; }
    if (k === 'enter') {
      if (this.state.sel.length !== 1) return;
      const id = this.state.sel[0], s = this.sheet();
      if (s.edges.some(x => x.id === id)) this.startEdit('edge', id);
      else { const n = s.nodes.find(q => q.id === id); if (n && !F.LABELLESS[n.type]) this.startEdit('node', id); }
      e.preventDefault();
      return;
    }
    const dir = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k];
    if (dir) {
      if (!this.state.sel.length) return;
      e.preventDefault();
      const step = e.shiftKey ? this.g() : 1, ids = new Set(this.state.sel);
      this.pushHistory('nudge');
      this.setNodes(a => a.map(n => (ids.has(n.id) ? { ...n, x: n.x + dir[0] * step, y: n.y + dir[1] * step } : n)));
      return;
    }
    if (e.shiftKey && e.code === 'Digit1') { this.fit(); return; }
    if (e.shiftKey && e.code === 'Digit0') { this.zoomCenter(1 / this.view().k); return; }
    if (k === '=' || k === '+') { this.zoomCenter(1.2); return; }
    if (k === '-' || k === '_') { this.zoomCenter(1 / 1.2); return; }
    if (!e.shiftKey && !e.altKey && F.KEYS[k]) this.setTool(F.KEYS[k]);
  }
  onKeyUp(e) { if (e.key === ' ' && this.state.space) this.setState({ space: false }); }

  // ---------- sheets and whole-project changes
  resetTransient() { this.undoStack = []; this.redoStack = []; this.drag = null; return { sel: [], editing: null, hover: null, temp: null, draft: null, marquee: null, guides: [], delArm: false }; }
  switchSheet(id) {
    if (id === this.state.doc.active) return;
    this.setState(st => ({ doc: { ...st.doc, active: id }, ...this.resetTransient() }));
  }
  addSheet() {
    const d = this.state.doc;
    const nums = d.sheets.map(s => parseInt(String(s.number).replace(/\D/g, ''), 10)).filter(n => !isNaN(n));
    const sh = F.newSheet('A-' + (nums.length ? Math.max(...nums) + 1 : 101));
    this.setState({ doc: { ...d, sheets: [...d.sheets, sh], active: sh.id }, ...this.resetTransient() });
  }
  delSheet() {
    if (!this.state.delArm) {
      this.setState({ delArm: true });
      clearTimeout(this._armT);
      this._armT = setTimeout(() => this.setState({ delArm: false }), 2500);
      return;
    }
    const d = this.state.doc, s = this.sheet();
    if (d.sheets.length < 2) return;
    const i = d.sheets.indexOf(s), rest = d.sheets.filter(q => q !== s);
    this.replaceDoc({ ...d, sheets: rest, active: rest[Math.max(0, i - 1)].id }, `Deleted ${s.number}`);
  }
  // Swaps in a new project and offers an undo, because these changes are outside the shape history.
  replaceDoc(doc, msg) {
    const prev = this.state.doc;
    this.setState({ doc, ...this.resetTransient() });
    this.flash(msg, 7000, { label: 'UNDO', run: () => { this.setState({ doc: prev, toast: null, ...this.resetTransient() }); } });
  }
  newDoc() {
    const d = this.state.doc, doc = F.blankDoc();
    doc.settings = { ...d.settings };
    doc.meta.drawnBy = d.meta.drawnBy;
    this.replaceDoc(doc, 'Started a new project');
  }

  // ---------- import and export
  flash(msg, ms = 2400, action = null) {
    this.setState({ toast: { msg, action } });
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.setState({ toast: null }), ms);
  }
  onFile(e) {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      let data = null;
      try { data = JSON.parse(r.result); } catch { data = null; }
      const doc = F.cleanDoc(data);
      if (doc) {
        doc.sheets = doc.sheets.map(s => ({ ...s, view: null }));
        this.replaceDoc(doc, 'Opened ' + f.name);
        return;
      }
      if (data && Array.isArray(data.nodes)) {
        // A single sheet, for example from another tool: add it to this project.
        const d = this.state.doc, sh = F.cleanSheet({ ...data, view: null }, new Set(d.sheets.map(s => s.id)), 'A-' + (101 + d.sheets.length));
        if (!data.name) sh.name = f.name.replace(/\.json$/i, '');
        this.replaceDoc({ ...d, sheets: [...d.sheets, sh], active: sh.id }, 'Added ' + f.name + ' as a new sheet');
        return;
      }
      this.flash('Could not read that file. Choose a Ferroprint JSON file.', 4000);
    };
    r.onerror = () => this.flash('Could not read that file.', 4000);
    r.readAsText(f);
  }
  exportJSON() {
    this.flushSave();
    const d = this.state.doc;
    F.download(new Blob([JSON.stringify(d, null, 2)], { type: 'application/json' }), `${F.slug(d.meta.project || 'ferroprint')}.ferroprint.json`);
    this.flash('Downloaded JSON');
  }
  titleBlockSVG(x, y, w, hh, t, L, s, meta) {
    const c1 = 190, c2 = 286, r = hh / 3, d = this.state.doc, idx = d.sheets.findIndex(q => q.id === s.id);
    const ln = (a, b, cc, dd) => `<line x1="${a}" y1="${b}" x2="${cc}" y2="${dd}" stroke="${t.ink}" stroke-width="1"/>`;
    const cell = (cx, cy, label, val, n, mono) => `<text x="${cx + 6}" y="${cy + 9}" font-family="IBM Plex Mono, monospace" font-size="7" letter-spacing="0.8" fill="${t.muted}">${label}</text><text x="${cx + 6}" y="${cy + 22}" font-family="${F.esc(mono ? F.MONO : L.family)}" font-weight="${mono ? 400 : L.weight}" font-size="${mono ? 10 : 13}" letter-spacing="0.6" fill="${t.ink}">${F.esc(F.trunc(String(val || '—').toUpperCase(), n))}</text>`;
    let o = `<g><rect x="${x}" y="${y}" width="${w}" height="${hh}" fill="${t.paper}" stroke="${t.ink}" stroke-width="1.5"/>`;
    o += ln(x, y + r, x + w, y + r) + ln(x, y + 2 * r, x + w, y + 2 * r) + ln(x + c1, y, x + c1, y + hh) + ln(x + c2, y, x + c2, y + 2 * r) + ln(x + 95, y + 2 * r, x + 95, y + hh);
    o += cell(x, y, 'PROJECT', meta.project, 24) + cell(x + c1, y, 'DWG NO', s.number, 12, true) + cell(x + c2, y, 'REV', meta.rev, 12, true);
    o += cell(x, y + r, 'TITLE', s.name, 24) + cell(x + c1, y + r, 'SCALE', F.scaleLabel(s.unit, this.g()), 14, true) + cell(x + c2, y + r, 'SHEET', `${idx + 1} OF ${d.sheets.length}`, 12, true);
    o += cell(x, y + 2 * r, 'DRAWN BY', meta.drawnBy, 11) + cell(x + 95, y + 2 * r, 'DATE', meta.date, 12, true);
    o += `<text x="${x + c1 + (w - c1) / 2}" y="${y + 2 * r + r / 2 + 5}" text-anchor="middle" font-family="Barlow Condensed, sans-serif" font-weight="600" font-size="14" letter-spacing="3" fill="${t.ink}">FERROPRINT</text></g>`;
    return o;
  }
  async buildSVG() {
    // Clear the selection first, so selected connectors are not exported in the accent color.
    await new Promise(r => this.setState({ sel: [], hover: null, temp: null, guides: [], marquee: null }, () => requestAnimationFrame(() => setTimeout(r, 30))));
    const s = this.sheet(), t = F.THEMES[this.state.mode], L = this.letter(), g = this.g(), meta = this.state.doc.meta;
    const b = F.bounds(s.nodes) || { x: 0, y: 0, w: 640, h: 400 };
    const pad = 90, tbW = 380, tbH = 84;
    const W = Math.ceil(Math.max(b.w + pad * 2, tbW + 160)), H = Math.ceil(b.h + pad * 2 + tbH);
    const x0 = Math.floor(b.x + b.w / 2 - W / 2), y0 = Math.floor(b.y - pad);
    const content = this.contentEl ? new XMLSerializer().serializeToString(this.contentEl) : '';
    const fonts = await F.fontCSS(L, this.fontCache);
    const tb = this.titleBlockSVG(x0 + W - 16 - tbW, y0 + H - 16 - tbH, tbW, tbH, t, L, s, meta);
    const str = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="${x0} ${y0} ${W} ${H}"><defs><style><![CDATA[${fonts}]]></style>`
      + `<pattern id="ex-minor" width="${g}" height="${g}" patternUnits="userSpaceOnUse"><path d="M${g} 0 L0 0 0 ${g}" fill="none" stroke="${t.minor}" stroke-width="2"/></pattern>`
      + `<pattern id="ex-major" width="${g * 5}" height="${g * 5}" patternUnits="userSpaceOnUse"><path d="M${g * 5} 0 L0 0 0 ${g * 5}" fill="none" stroke="${t.major}" stroke-width="2"/></pattern>`
      + `<pattern id="fp-hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="4" y1="0" x2="4" y2="8" stroke="${t.hatch}" stroke-width="1.5"/></pattern></defs>`
      + `<rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="${t.paper}"/><rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#ex-minor)"/><rect x="${x0}" y="${y0}" width="${W}" height="${H}" fill="url(#ex-major)"/>`
      + `<rect x="${x0 + 10}" y="${y0 + 10}" width="${W - 20}" height="${H - 20}" fill="none" stroke="${t.ink}" stroke-width="2"/><rect x="${x0 + 16}" y="${y0 + 16}" width="${W - 32}" height="${H - 32}" fill="none" stroke="${t.ink}" stroke-width="1"/>`
      + content + tb + `</svg>`;
    return { str, W, H, name: `${s.number}-${F.slug(s.name)}` };
  }
  async exportImg(kind) {
    if (this._busy) return;
    this._busy = true;
    const sel = this.state.sel;
    this.setState({ toast: { msg: `Exporting ${kind.toUpperCase()}…` } });
    clearTimeout(this._toastT);
    try {
      const r = await this.buildSVG();
      if (kind === 'svg') F.download(new Blob([r.str], { type: 'image/svg+xml' }), r.name + '.svg');
      else {
        const img = new Image();
        await new Promise((ok, bad) => { img.onload = ok; img.onerror = bad; img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(r.str); });
        const sc = Math.min(2, 8000 / Math.max(r.W, r.H)), c = document.createElement('canvas');
        c.width = Math.round(r.W * sc); c.height = Math.round(r.H * sc);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        const blob = await new Promise((ok, bad) => c.toBlob(b => (b ? ok(b) : bad(new Error('The PNG encoder returned no data'))), 'image/png'));
        F.download(blob, r.name + '.png');
      }
      this.flash(`Downloaded ${r.name}.${kind}`);
    } catch (err) {
      console.warn(err);
      this.flash('Export failed. Try SVG, or try again.', 4000);
    }
    const live = new Set([...this.sheet().nodes.map(n => n.id), ...this.sheet().edges.map(x => x.id)]);
    this.setState({ sel: sel.filter(id => live.has(id)) });
    this._busy = false;
  }

  // ---------- drawing
  cachedNode(n, ctx, key) {
    const c = this.nodeCache.get(n);
    if (c && c.key === key) return c.el;
    const el = renderNode(n, ctx);
    this.nodeCache.set(n, { key, el });
    return el;
  }
  cachedEdge(e, map, ctx, key, selected) {
    const a = map[e.from], b = map[e.to], c = this.edgeCache.get(e);
    if (c && c.key === key && c.a === a && c.b === b && c.selected === selected) return c.el;
    const el = renderEdge(e, map, ctx, selected);
    this.edgeCache.set(e, { key, a, b, selected, el });
    return el;
  }
  renderOverlay(s, t, map, selSet) {
    const st = this.state, k = this.view().k, A = t.accent, sw = 1.25 / k, out = [];
    const selNodes = s.nodes.filter(n => selSet.has(n.id));
    selNodes.forEach(n => {
      if (n.type === 'line') return;
      const b = F.hitBox(n), p = 5 / k;
      out.push(<rect key={'sel' + n.id} x={b.x - p} y={b.y - p} width={b.w + 2 * p} height={b.h + 2 * p} fill="none" stroke={A} strokeWidth={sw} strokeDasharray={`${4 / k} ${3 / k}`} pointerEvents="none" />);
    });
    const single = selNodes.length === 1 && st.sel.length === 1 && !st.editing ? selNodes[0] : null;
    if (single && st.dims) out.push(...renderDims(single, this.drawCtx(s), k));
    if (single) {
      const hs = 8 / k;
      if (single.type === 'line') {
        F.linePts(single).forEach((q, i) => out.push(<rect key={'p' + i} x={q.x - hs / 2} y={q.y - hs / 2} width={hs} height={hs} fill={t.paper} stroke={A} strokeWidth={1.4 / k} data-k="handle" data-id={single.id} data-h={'p' + i} style={{ cursor: 'move' }} />));
      } else {
        Object.keys(F.HANDLES).forEach(key => {
          const [fx, fy] = F.HANDLES[key];
          out.push(<rect key={'h' + key} x={single.x + single.w * fx - hs / 2} y={single.y + single.h * fy - hs / 2} width={hs} height={hs} fill={t.paper} stroke={A} strokeWidth={1.4 / k} data-k="handle" data-id={single.id} data-h={key} style={{ cursor: F.HCUR[key] }} />);
        });
      }
    }
    const hv = st.hover && map[st.hover];
    if (hv && !this.drag && !st.editing && (st.tool === 'select' || st.tool === 'connector') && hv.type !== 'path' && hv.type !== 'line') {
      const o = 14 / k;
      [['top', 0, -o], ['right', o, 0], ['bottom', 0, o], ['left', -o, 0]].forEach(([sd, ox, oy]) => {
        const q = F.sidePt(hv, sd);
        out.push(<circle key={'pt' + sd} cx={q.x + ox} cy={q.y + oy} r={4.5 / k} fill={t.paper} stroke={t.ink} strokeWidth={1.3 / k} data-k="port" data-id={hv.id} style={{ cursor: 'crosshair' }} />);
      });
    }
    if (st.temp) {
      const a = map[st.temp.from];
      if (a) {
        const tg = st.temp.target && map[st.temp.target], dash = `${6 / k} ${4 / k}`;
        if (tg) {
          const geo = F.edgeGeom({ from: a.id, to: tg.id, route: this.defRoute() }, map), p = 5 / k;
          if (geo) out.push(<path key="tmp" d={geo.d} fill="none" stroke={A} strokeWidth={1.6} strokeDasharray={dash} pointerEvents="none" />);
          out.push(<rect key="tgt" x={tg.x - p} y={tg.y - p} width={tg.w + 2 * p} height={tg.h + 2 * p} fill="none" stroke={A} strokeWidth={2 / k} pointerEvents="none" />);
        } else {
          const [s1] = F.autoSides(a, { x: st.temp.p.x, y: st.temp.p.y, w: 0, h: 0 }), q = F.sidePt(a, s1);
          out.push(
            <line key="tmp" x1={q.x} y1={q.y} x2={st.temp.p.x} y2={st.temp.p.y} stroke={A} strokeWidth={1.6} strokeDasharray={dash} pointerEvents="none" />,
            <circle key="tmpc" cx={st.temp.p.x} cy={st.temp.p.y} r={3.5 / k} fill={A} pointerEvents="none" />
          );
        }
      }
    }
    st.guides.forEach((gd, i) => out.push(<line key={'g' + i} x1={gd.x1} y1={gd.y1} x2={gd.x2} y2={gd.y2} stroke={A} strokeWidth={1 / k} strokeDasharray={`${3 / k} ${3 / k}`} pointerEvents="none" />));
    if (st.marquee) { const m = st.marquee; out.push(<rect key="mq" x={m.x} y={m.y} width={m.w} height={m.h} fill={A} fillOpacity={0.08} stroke={A} strokeWidth={1 / k} strokeDasharray={`${4 / k} ${3 / k}`} pointerEvents="none" />); }
    if (st.ghost) {
      const n = { ...F.newNode(st.ghost.shape, this.placeRect(st.ghost.shape, st.ghost.p)), id: '__ghost' }, b = F.hitBox(n);
      out.push(
        <g key="ghost" opacity={0.6} pointerEvents="none">{renderNode(n, this.drawCtx(s))}</g>,
        <rect key="ghostbox" x={b.x - 5 / k} y={b.y - 5 / k} width={b.w + 10 / k} height={b.h + 10 / k} fill="none" stroke={A} strokeWidth={1 / k} strokeDasharray={`${4 / k} ${3 / k}`} pointerEvents="none" />
      );
    }
    if (st.draft && st.draft.pts.length > 1) out.push(<path key="dr" d={'M' + st.draft.pts.map(q => `${q.x} ${q.y}`).join(' L')} fill="none" stroke={t.ink} strokeWidth={st.draft.kind === 'line' ? F.WEIGHTS.m : F.WEIGHTS.s} strokeLinecap="round" strokeLinejoin="round" pointerEvents="none" />);
    return out;
  }
  renderEditor(s, ctx) {
    const ed = this.state.editing;
    if (!ed) return null;
    const { t, L } = ctx, v = this.view(), k = v.k;
    let box, align = 'center', fs = 16;
    if (ed.kind === 'node') {
      const n = s.nodes.find(q => q.id === ed.id);
      if (!n) return null;
      fs = F.SIZES[n.size || 'm'] * (n.type === 'note' ? 0.9 : n.type === 'zone' ? 0.95 : 1);
      if (n.type === 'actor') box = { x: n.x + n.w / 2 - 90, y: n.y + n.h + 2, w: 180, h: 44 };
      else if (n.type === 'zone') { box = { x: n.x, y: n.y, w: Math.max(220, Math.min(n.w, 320)), h: 30 }; align = 'left'; }
      else if (n.type === 'window') { box = { x: n.x + 50, y: n.y, w: Math.max(120, n.w - 50), h: 28 }; align = 'left'; fs *= 0.85; }
      else if (n.type === 'note' || n.type === 'input') { box = { x: n.x, y: n.y, w: n.w, h: n.h }; align = 'left'; }
      else box = { x: n.x, y: n.y, w: Math.max(n.w, 120), h: Math.max(n.h, 40) };
    } else {
      const e = s.edges.find(q => q.id === ed.id), geo = e && F.edgeGeom(e, this.nodeMap(s));
      if (!geo) return null;
      fs = 13; box = { x: geo.mid.x - 90, y: geo.mid.y - 18, w: 180, h: 36 };
    }
    const left = v.x + box.x * k, top = v.y + box.y * k, w = box.w * k, hh = box.h * k, fpx = fs * k;
    const lines = Math.max(1, String(ed.value).split('\n').length), lhp = fpx * L.lh;
    const padTop = align === 'center' ? Math.max(2, (hh - lines * lhp) / 2) : Math.max(2, Math.min(10 * k, (hh - lhp) / 2));
    return (
      <textarea
        key="ed" autoFocus value={ed.value} spellCheck={false} aria-label="Label"
        onFocus={ev => ev.target.select()}
        onChange={ev => this.setState({ editing: { ...this.state.editing, value: ev.target.value } })}
        onKeyDown={ev => {
          if (ev.key === 'Escape') { ev.preventDefault(); this.cancelEdit(); }
          else if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); this.commitEdit(); }
        }}
        onBlur={() => this.commitEdit()}
        onPointerDown={ev => ev.stopPropagation()}
        onDoubleClick={ev => ev.stopPropagation()}
        className="label-editor"
        style={{ left, top, width: w, height: hh, padding: `${padTop}px ${8 * k}px 0`, background: t.paper, color: t.ink, border: `1.5px solid ${t.accent}`, textAlign: align, fontFamily: L.family, fontWeight: L.weight, fontSize: fpx, lineHeight: L.lh, letterSpacing: `${L.ls}em`, textTransform: ctx.caps ? 'uppercase' : 'none' }}
      />
    );
  }
  renderCanvas(s, ctx) {
    const st = this.state, v = this.view(), k = v.k, g = this.g(), { t } = ctx;
    const map = this.nodeMap(s), selSet = new Set(st.sel);
    const zones = s.nodes.filter(n => n.type === 'zone'), rest = s.nodes.filter(n => n.type !== 'zone');
    const ptf = `translate(${v.x} ${v.y}) scale(${k})`;
    const key = `${st.mode}|${ctx.L.css}|${ctx.caps}|${s.unit}|${g}|${this.fontGen}`;
    const panTool = st.tool === 'hand' || st.space;
    const cursor = panTool ? (st.panning ? 'grabbing' : 'grab') : st.tool === 'select' ? 'default' : 'crosshair';
    return (
      <div ref={this.setCanvas} className="canvas" onPointerDown={this.onDown} onDoubleClick={this.onDbl} onContextMenu={e => e.preventDefault()} style={{ cursor }}>
        <svg width="100%" height="100%" style={{ display: 'block' }}>
          <defs>
            <pattern id="fp-minor" width={g} height={g} patternUnits="userSpaceOnUse" patternTransform={ptf}><path d={`M${g} 0 L0 0 0 ${g}`} fill="none" stroke={t.minor} strokeWidth={2 / k} /></pattern>
            <pattern id="fp-major" width={g * 5} height={g * 5} patternUnits="userSpaceOnUse" patternTransform={ptf}><path d={`M${g * 5} 0 L0 0 0 ${g * 5}`} fill="none" stroke={t.major} strokeWidth={2 / k} /></pattern>
            <pattern id="fp-hatch" width={8} height={8} patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1={4} y1={0} x2={4} y2={8} stroke={t.hatch} strokeWidth={1.5} /></pattern>
          </defs>
          {g * k >= 8 && <rect width="100%" height="100%" fill="url(#fp-minor)" />}
          <rect width="100%" height="100%" fill="url(#fp-major)" />
          <g transform={ptf}>
            <g ref={this.setContent}>
              {zones.map(n => this.cachedNode(n, ctx, key))}
              {s.edges.map(e => this.cachedEdge(e, map, ctx, key, selSet.has(e.id)))}
              {rest.map(n => this.cachedNode(n, ctx, key))}
            </g>
            <g>{this.renderOverlay(s, t, map, selSet)}</g>
          </g>
        </svg>
        {this.renderEditor(s, ctx)}
      </div>
    );
  }

  render() {
    const st = this.state, d = st.doc, s = this.sheet(), ctx = this.drawCtx(s), t = ctx.t, v = this.view(), g = this.g();
    const ids = new Set(st.sel), map = this.nodeMap(s);
    const nc = Math.max(4, Math.round((st.win.w - 56) / 210)), nr = Math.max(3, Math.round((st.win.h - 56) / 210));
    const cols = Array.from({ length: nc }, (_, i) => String.fromCharCode(65 + i));
    const rows = Array.from({ length: nr }, (_, i) => String(i + 1));
    const wide = st.win.w >= 1080, tiny = st.win.w < 640;
    const tool = st.space ? 'hand' : st.tool;
    const idx = d.sheets.findIndex(q => q.id === s.id), meta = d.meta;
    const updS = key => val => this.updSheet(() => ({ [key]: val }));
    const vars = {
      '--paper': t.paper, '--ink': t.ink, '--muted': t.muted, '--panel': t.panel, '--hover': t.hover, '--line': t.line,
      '--accent': t.accent, '--accent-ink': t.accentInk, '--vig': t.vig, '--pal-top': st.palTop + 'px'
    };
    return (
      <div className={'app' + (tiny ? ' tiny' : '')} style={vars}>
        <div className="sheet-area">{this.renderCanvas(s, ctx)}</div>
        <Frame cols={cols} rows={rows} texture={TEXTURES[st.mode]} />

        {s.nodes.length === 0 && !this.drag && (
          <div className="empty">
            <div>
              <h2>EMPTY SHEET</h2>
              <p>Pick a shape on the left and click or drag on the sheet. The library has doors, furniture and more. Drag from the small circles around a shape to connect it to another. Double-click empty space to write a label.</p>
            </div>
          </div>
        )}

        <TopBar
          barRef={this.barRef} save={st.save} canUndo={this.undoStack.length > 0} canRedo={this.redoStack.length > 0}
          snap={st.snap} dims={st.dims} mode={st.mode} panel={st.panel}
          on={{
            undo: () => this.doUndo(), redo: () => this.doRedo(),
            snap: () => this.setState({ snap: !st.snap }), dims: () => this.setState({ dims: !st.dims }),
            blue: () => this.setState({ mode: 'blue' }), white: () => this.setState({ mode: 'white' }),
            newDoc: () => this.newDoc(), open: () => this.openFile(),
            png: () => this.exportImg('png'), svg: () => this.exportImg('svg'), json: () => this.exportJSON(),
            setup: () => this.togglePanel('setup'), help: () => this.togglePanel('help')
          }}
        />
        <Palette
          tool={st.tool} onTool={id => this.setTool(id)} recent={st.recent} theme={t}
          libraryOpen={st.panel === 'library'} onLibrary={() => this.togglePanel('library')} onSymbol={id => this.pickSymbol(id)}
        />

        <Inspector
          nodes={s.nodes.filter(n => ids.has(n.id))} edges={s.edges.filter(e => ids.has(e.id))} nodeById={map}
          fmt={px => F.fmtLen(px, s.unit, g)}
          setNode={(id, patch, key) => { this.pushHistory(key); this.setNodes(a => a.map(q => (q.id === id ? { ...q, ...patch } : q))); }}
          setEdge={(id, patch, key) => { this.pushHistory(key); this.setEdges(a => a.map(q => (q.id === id ? { ...q, ...patch } : q))); }}
          act={{
            front: () => this.arrange(true), back: () => this.arrange(false), dup: () => this.duplicate(), del: () => this.del(), wrap: () => this.wrapZone(),
            align: kind => this.align(kind), distribute: axis => this.distribute(axis),
            rotate: () => this.rotateSel(), flip: () => this.flipSel(),
            reverse: () => { const id = st.sel[0]; this.pushHistory(); this.setEdges(a => a.map(q => (q.id === id ? { ...q, from: q.to, to: q.from } : q))); }
          }}
        />

        {st.panel === 'help' && <HelpPanel onClose={() => this.setState({ panel: null })} />}
        {st.panel === 'library' && (
          <LibraryPanel
            tool={st.tool} theme={t} onPick={id => this.pickSymbol(id)} onDragStart={(id, e) => this.startPlace(id, e)}
            onClose={() => this.setState({ panel: null })}
          />
        )}
        {st.panel === 'setup' && <SetupPanel settings={d.settings} onSet={patch => this.setSettings(patch)} onClose={() => this.setState({ panel: null })} />}

        {!tiny && (
          <TitleBlock
            wide={wide}
            tb={{
              project: meta.project, setProject: val => this.setMeta('project', val),
              drawn: meta.drawnBy, setDrawn: val => this.setMeta('drawnBy', val),
              date: meta.date, setDate: val => this.setMeta('date', val),
              rev: meta.rev, setRev: val => this.setMeta('rev', val),
              num: s.number, setNum: updS('number'), name: s.name, setName: updS('name'),
              scale: F.scaleLabel(s.unit, g), sheetOf: `${idx + 1} OF ${d.sheets.length}`,
              cycleUnit: () => this.updSheet(q => ({ unit: F.UNITS[(F.UNITS.indexOf(q.unit) + 1) % F.UNITS.length] }))
            }}
          />
        )}

        <StatusBar
          right={wide ? 500 : tiny ? 40 : 280} cursor={st.cursor} zoomPct={Math.round(v.k * 100) + '%'}
          tool={(F.TOOL_NAMES[tool] || tool).toUpperCase() + (F.KEY_OF[tool] ? ` · ${F.KEY_OF[tool]}` : '')}
          hint={F.HINTS[tool] || (F.TURN[tool] ? 'Click to place · drag to size · ⇧R rotates' : 'Click to place · drag to size')}
          tabs={d.sheets.map(q => ({ id: q.id, num: q.number, name: q.name || 'Untitled', full: `${q.number} ${q.name || ''}`, active: q.id === s.id, on: () => this.switchSheet(q.id) }))}
          delLabel={st.delArm ? 'CONFIRM DELETE' : 'DELETE SHEET'}
          on={{
            zoomIn: () => this.zoomCenter(1.2), zoomOut: () => this.zoomCenter(1 / 1.2), zoom100: () => this.zoomCenter(1 / v.k), fit: () => this.fit(),
            addSheet: () => this.addSheet(), delSheet: () => this.delSheet()
          }}
        />

        <Toast toast={st.toast} />
        <input ref={this.fileRef} type="file" accept=".json,application/json" onChange={this.onFile} hidden />
      </div>
    );
  }
}

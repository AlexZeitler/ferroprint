// Ferroprint engine: constants, geometry, document model, export helpers.

export const MONO = "'IBM Plex Mono', ui-monospace, monospace";

export const LETTER = {
  technical: { family: "'Barlow Condensed', 'Arial Narrow', sans-serif", weight: 500, ls: 0.05, lh: 1.15, css: 'family=Barlow+Condensed:wght@500;600' },
  hand: { family: "'Architects Daughter', 'Comic Sans MS', cursive", weight: 400, ls: 0.03, lh: 1.3, css: 'family=Architects+Daughter&family=Barlow+Condensed:wght@600' }
};
export const SIZES = { s: 13, m: 16, l: 22 };
export const WEIGHTS = { s: 1.5, m: 3, l: 6 };
export const SHAPES = {
  box: { name: 'Box', w: 160, h: 80, label: 'Component' },
  service: { name: 'Service', w: 160, h: 80, label: 'Service' },
  database: { name: 'Database', w: 120, h: 110, label: 'Database' },
  queue: { name: 'Queue', w: 200, h: 70, label: 'Queue' },
  actor: { name: 'Actor', w: 60, h: 90, label: 'User' },
  zone: { name: 'Zone', w: 420, h: 280, label: 'Zone' },
  decision: { name: 'Decision', w: 160, h: 100, label: 'Decision?' },
  terminal: { name: 'Terminal', w: 140, h: 56, label: 'Start' },
  window: { name: 'Window', w: 360, h: 260, label: 'Window' },
  button: { name: 'Button', w: 120, h: 40, label: 'Button' },
  input: { name: 'Input', w: 240, h: 40, label: 'Input' },
  image: { name: 'Image', w: 160, h: 120, label: 'Image' },
  room: { name: 'Room', w: 240, h: 200, label: 'Room' },
  door: { name: 'Door', w: 60, h: 60, label: '' },
  note: { name: 'Note', w: 200, h: 120, label: 'Note' },
  text: { name: 'Text', w: 160, h: 40, label: 'Label' }
};
export const TYPE_NAME = { path: 'Freehand', line: 'Line', ...Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.name])) };
export const TOOL_NAMES = { select: 'Select', hand: 'Pan', connector: 'Connector', pen: 'Pen', line: 'Line / wall', ...Object.fromEntries(Object.entries(SHAPES).map(([k, v]) => [k, v.name])) };
export const KEYS = { v: 'select', h: 'hand', c: 'connector', p: 'pen', l: 'line', b: 'box', r: 'service', d: 'database', q: 'queue', u: 'actor', g: 'zone', k: 'decision', e: 'terminal', w: 'window', o: 'button', i: 'input', m: 'image', n: 'note', t: 'text' };
export const KEY_OF = Object.fromEntries(Object.entries(KEYS).map(([k, v]) => [v, k.toUpperCase()]));
export const HINTS = {
  select: 'Click to select · drag to move · shift-click to add',
  hand: 'Drag to pan the sheet',
  connector: 'Drag from one shape to another',
  pen: 'Draw freehand strokes',
  line: 'Drag to draw · shift snaps to 45°',
  zone: 'Drag to frame a region',
  door: 'Click to place · flip it in the inspector'
};
export const LABELLESS = { door: 1, path: 1, line: 1 };
export const NOFILL = { text: 1, actor: 1, door: 1, path: 1, line: 1 };
export const THEMES = {
  blue: { paper: '#1e4d8c', ink: '#eef4ff', muted: 'rgba(238,244,255,0.74)', panel: '#1a4580', hover: 'rgba(238,244,255,0.10)', line: 'rgba(238,244,255,0.32)', minor: 'rgba(238,244,255,0.075)', major: 'rgba(238,244,255,0.17)', tint: 'rgba(238,244,255,0.10)', hatch: 'rgba(238,244,255,0.42)', accent: '#f4bf4f', accentInk: '#1a2a48', vig: 'rgba(3,12,36,0.40)', tex: [1, 1, 1] },
  white: { paper: '#f4f2eb', ink: '#24398a', muted: 'rgba(36,57,138,0.78)', panel: '#ece9df', hover: 'rgba(36,57,138,0.08)', line: 'rgba(36,57,138,0.30)', minor: 'rgba(36,57,138,0.07)', major: 'rgba(36,57,138,0.15)', tint: 'rgba(36,57,138,0.07)', hatch: 'rgba(36,57,138,0.38)', accent: '#d1432f', accentInk: '#ffffff', vig: 'rgba(80,64,20,0.14)', tex: [0.14, 0.22, 0.54] }
};
export const HANDLES = { nw: [0, 0], n: [0.5, 0], ne: [1, 0], e: [1, 0.5], se: [1, 1], s: [0.5, 1], sw: [0, 1], w: [0, 0.5] };
export const HCUR = { nw: 'nwse-resize', se: 'nwse-resize', ne: 'nesw-resize', sw: 'nesw-resize', n: 'ns-resize', s: 'ns-resize', e: 'ew-resize', w: 'ew-resize' };
export const NORM = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, top: { x: 0, y: -1 }, bottom: { x: 0, y: 1 } };

export const UNITS = ['px', 'ft', 'm'];
export const GRIDS = [10, 20, 25];
export const ROUTES = ['elbow', 'straight', 'curve'];
export const DEFAULT_SETTINGS = { lettering: 'hand', caps: true, grid: 20, route: 'elbow' };

// ---------- small helpers
export const uid = () => Math.random().toString(36).slice(2, 9);
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const f1 = v => Math.round(v * 10) / 10;
export const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const slug = s => (String(s || 'sheet').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sheet');
export const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
export const today = () => new Date().toISOString().slice(0, 10);

// ---------- geometry
export function sidePt(b, s) {
  if (s === 'left') return { x: b.x, y: b.y + b.h / 2 };
  if (s === 'right') return { x: b.x + b.w, y: b.y + b.h / 2 };
  if (s === 'top') return { x: b.x + b.w / 2, y: b.y };
  return { x: b.x + b.w / 2, y: b.y + b.h };
}
export function autoSides(a, b) {
  const gx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w));
  const gy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h));
  const dx = (b.x + b.w / 2) - (a.x + a.w / 2), dy = (b.y + b.h / 2) - (a.y + a.h / 2);
  if (gx >= gy) return dx >= 0 ? ['right', 'left'] : ['left', 'right'];
  return dy >= 0 ? ['bottom', 'top'] : ['top', 'bottom'];
}
export function clipBox(c, to, b) {
  const dx = to.x - c.x, dy = to.y - c.y;
  if (!dx && !dy) return c;
  const sx = dx ? (b.w / 2) / Math.abs(dx) : Infinity, sy = dy ? (b.h / 2) / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy, 1);
  return { x: c.x + dx * s, y: c.y + dy * s };
}
export const unit = (a, b) => { const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1; return { x: dx / l, y: dy / l }; };
export function bez(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return { x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x, y: u * u * u * p0.y + 3 * u * u * t * p1.y + 3 * u * t * t * p2.y + t * t * t * p3.y };
}
export const inter = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
export const within = (a, b) => a.x >= b.x && a.y >= b.y && a.x + a.w <= b.x + b.w && a.y + a.h <= b.y + b.h;
export const rectFrom = (a, b) => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y), w: Math.abs(a.x - b.x), h: Math.abs(a.y - b.y) });

// The actor label sits below the figure, so its hit area is larger than its box.
export const hitBox = n => (n.type === 'actor' ? { x: n.x - 20, y: n.y, w: n.w + 40, h: n.h + 30 } : { x: n.x, y: n.y, w: n.w, h: n.h });
export function plainBounds(ns) {
  if (!ns.length) return null;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  ns.forEach(n => { x0 = Math.min(x0, n.x); y0 = Math.min(y0, n.y); x1 = Math.max(x1, n.x + n.w); y1 = Math.max(y1, n.y + n.h); });
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export function bounds(ns) {
  const b = plainBounds(ns.map(hitBox));
  return b && { ...b, w: Math.max(1, b.w), h: Math.max(1, b.h) };
}
export const linePts = n => (n.pts || []).map(([a, b]) => ({ x: n.x + a * n.w, y: n.y + b * n.h }));
export function pathFrom(pts) {
  const xs = pts.map(q => q.x), ys = pts.map(q => q.y);
  const x = Math.min(...xs), y = Math.min(...ys);
  const w = Math.max(...xs) - x, h = Math.max(...ys) - y;
  return { x, y, w, h, pts: pts.map(q => [w ? +((q.x - x) / w).toFixed(4) : 0, h ? +((q.y - y) / h).toFixed(4) : 0]) };
}
export function constrain(a, b) {
  const ang = Math.atan2(b.y - a.y, b.x - a.x), s = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4), l = Math.hypot(b.x - a.x, b.y - a.y);
  return { x: Math.round(a.x + Math.cos(s) * l), y: Math.round(a.y + Math.sin(s) * l) };
}
export function edgeGeom(e, map) {
  const a = map[e.from], b = map[e.to];
  if (!a || !b) return null;
  const route = e.route || 'elbow';
  if (route === 'straight') {
    const ac = { x: a.x + a.w / 2, y: a.y + a.h / 2 }, bc = { x: b.x + b.w / 2, y: b.y + b.h / 2 };
    const p1 = clipBox(ac, bc, a), p2 = clipBox(bc, ac, b);
    return { d: `M${p1.x} ${p1.y} L${p2.x} ${p2.y}`, p1, p2, mid: { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }, endDir: unit(p1, p2), startDir: unit(p2, p1) };
  }
  const [s1, s2] = autoSides(a, b), p1 = sidePt(a, s1), p2 = sidePt(b, s2);
  if (route === 'curve') {
    const n1 = NORM[s1], n2 = NORM[s2], kk = Math.max(30, Math.hypot(p2.x - p1.x, p2.y - p1.y) * 0.45);
    const c1 = { x: p1.x + n1.x * kk, y: p1.y + n1.y * kk }, c2 = { x: p2.x + n2.x * kk, y: p2.y + n2.y * kk };
    return { d: `M${p1.x} ${p1.y} C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${p2.x} ${p2.y}`, p1, p2, mid: bez(p1, c1, c2, p2, 0.5), endDir: unit(c2, p2), startDir: unit(c1, p1) };
  }
  let pts;
  if (s1 === 'left' || s1 === 'right') { const mx = Math.round((p1.x + p2.x) / 2); pts = [p1, { x: mx, y: p1.y }, { x: mx, y: p2.y }, p2]; }
  else { const my = Math.round((p1.y + p2.y) / 2); pts = [p1, { x: p1.x, y: my }, { x: p2.x, y: my }, p2]; }
  return { d: 'M' + pts.map(q => `${q.x} ${q.y}`).join(' L'), p1, p2, mid: { x: (pts[1].x + pts[2].x) / 2, y: (pts[1].y + pts[2].y) / 2 }, endDir: { x: -NORM[s2].x, y: -NORM[s2].y }, startDir: { x: -NORM[s1].x, y: -NORM[s1].y } };
}

// ---------- units: one grid square is 1 ft or 0.5 m on a scaled sheet
export function fmtLen(px, u, g) {
  if (u === 'px') return String(Math.round(px));
  const sq = px / g;
  if (u === 'm') return (Math.round(sq * 0.5 * 100) / 100) + ' m';
  const tin = Math.round(sq * 12), ft = Math.floor(tin / 12), inch = tin % 12;
  return `${ft}'-${inch}"`;
}
export function areaLabel(n, u, g) {
  if (u === 'ft') return Math.round((n.w / g) * (n.h / g)) + ' SQ FT';
  if (u === 'm') return (Math.round((n.w / g) * 0.5 * (n.h / g) * 0.5 * 10) / 10) + ' M²';
  return '';
}
export const scaleLabel = (u, g) => (u === 'ft' ? '1 SQ = 1 FT' : u === 'm' ? '1 SQ = 0.5 M' : `1 SQ = ${g} PX`);

// ---------- text
let _ctx;
export function measure(t, font) {
  if (!_ctx) _ctx = document.createElement('canvas').getContext('2d');
  _ctx.font = font;
  return _ctx.measureText(t).width;
}
export function wrap(text, maxW, font, ls) {
  const out = [];
  String(text).split('\n').forEach(para => {
    const words = para.split(/\s+/).filter(Boolean);
    if (!words.length) { out.push(''); return; }
    let line = words[0];
    for (let i = 1; i < words.length; i++) {
      const t = line + ' ' + words[i];
      if (measure(t, font) + t.length * ls > maxW) { out.push(line); line = words[i]; } else line = t;
    }
    out.push(line);
  });
  return out;
}

// ---------- document model
export function newNode(type, r) {
  const sh = SHAPES[type];
  return { id: uid(), type, x: r.x, y: r.y, w: r.w, h: r.h, label: sh.label, sub: '', dashed: type === 'zone', fill: 'none', size: type === 'zone' ? 's' : 'm', flip: false };
}
export function newSheet(number) {
  return { id: uid(), number, name: 'Untitled sheet', unit: 'px', view: null, nodes: [], edges: [] };
}
export function blankDoc() {
  const s = newSheet('A-101');
  return { meta: { project: '', drawnBy: '', date: today(), rev: 'A' }, settings: { ...DEFAULT_SETTINGS }, sheets: [s], active: s.id };
}

function N(id, type, x, y, w, h, label, sub, extra) {
  return { id, type, x, y, w, h, label: label || '', sub: sub || '', dashed: type === 'zone', fill: 'none', size: type === 'zone' ? 's' : 'm', flip: false, ...extra };
}
function E(id, from, to, label, extra) { return { id, from, to, label: label || '', route: 'elbow', arrow: 'end', dashed: false, ...extra }; }
export function exampleDoc() {
  const s1 = {
    id: 's1', number: 'A-101', name: 'System overview', unit: 'px', view: null,
    nodes: [
      N('vpc', 'zone', 400, 60, 980, 620, 'VPC', 'us-east-1 · production'),
      N('users', 'actor', 100, 255, 60, 90, 'Customers'),
      N('lb', 'box', 460, 260, 160, 80, 'Load balancer', 'ALB · 443'),
      N('gw', 'service', 700, 260, 160, 80, 'API gateway', 'Envoy'),
      N('auth', 'service', 940, 120, 160, 80, 'Auth', 'OIDC · Go'),
      N('orders', 'service', 940, 260, 160, 80, 'Orders', 'gRPC · Go'),
      N('pay', 'service', 940, 400, 160, 80, 'Payments', 'REST · Node'),
      N('udb', 'database', 1200, 105, 120, 110, 'Users DB', 'Postgres 16'),
      N('odb', 'database', 1200, 245, 120, 110, 'Orders DB', 'Postgres 16'),
      N('bus', 'queue', 920, 540, 200, 70, 'Event bus', 'Kafka'),
      N('ful', 'box', 1200, 540, 140, 70, 'Fulfillment', 'worker × 3'),
      N('stripe', 'box', 1460, 400, 140, 80, 'Stripe', 'external', { dashed: true }),
      N('note1', 'note', 1460, 100, 220, 120, 'All internal traffic uses mTLS. Certificates rotate every 30 days.')
    ],
    edges: [E('e1', 'users', 'lb', 'HTTPS'), E('e2', 'lb', 'gw'), E('e3', 'gw', 'auth'), E('e4', 'gw', 'orders'), E('e5', 'gw', 'pay'), E('e6', 'auth', 'udb'), E('e7', 'orders', 'odb'), E('e8', 'pay', 'bus', 'events', { dashed: true }), E('e9', 'bus', 'ful'), E('e10', 'pay', 'stripe', 'charges')]
  };
  const s2 = {
    id: 's2', number: 'A-102', name: 'Checkout flow', unit: 'px', view: null,
    nodes: [
      N('w1', 'window', 80, 80, 520, 440, 'Checkout'),
      N('t1', 'text', 120, 130, 200, 40, 'Payment details'),
      N('i1', 'input', 120, 190, 440, 44, 'Name on card'),
      N('i2', 'input', 120, 250, 440, 44, 'Card number'),
      N('i3', 'input', 120, 310, 210, 44, 'MM / YY'),
      N('i4', 'input', 350, 310, 210, 44, 'CVC'),
      N('b1', 'button', 240, 440, 140, 44, 'Back', '', { dashed: true }),
      N('b2', 'button', 400, 440, 160, 44, 'Place order', '', { fill: 'tint' }),
      N('dc', 'decision', 680, 412, 160, 100, 'Payment ok?'),
      N('err', 'box', 680, 600, 160, 60, 'Show card error'),
      N('w2', 'window', 920, 80, 360, 280, 'Order confirmed'),
      N('im', 'image', 960, 140, 280, 110, 'Illustration'),
      N('t2', 'text', 960, 262, 280, 36, 'Thanks — order #1042'),
      N('b3', 'button', 1030, 306, 140, 36, 'View order'),
      N('n2', 'note', 920, 420, 260, 110, 'Validate the card number inline. Keep Place order disabled until the form is valid.')
    ],
    edges: [E('f1', 'b2', 'dc'), E('f2', 'dc', 'w2', 'yes'), E('f3', 'dc', 'err', 'no'), E('f4', 'err', 'w1', '', { dashed: true })]
  };
  const s3 = {
    id: 's3', number: 'A-103', name: 'Ground floor plan', unit: 'ft', view: null,
    nodes: [
      N('r1', 'room', 80, 80, 320, 240, 'Living'),
      N('r2', 'room', 400, 80, 200, 240, 'Kitchen'),
      N('r3', 'room', 80, 320, 240, 200, 'Bedroom'),
      N('r4', 'room', 320, 320, 120, 200, 'Bath'),
      N('r5', 'room', 440, 320, 160, 200, 'Entry'),
      N('d1', 'door', 240, 260, 60, 60, ''),
      N('d2', 'door', 340, 260, 60, 60, '', '', { flip: true }),
      N('d3', 'door', 480, 460, 60, 60, ''),
      N('d4', 'door', 460, 260, 60, 60, '', '', { flip: true })
    ],
    edges: []
  };
  return { meta: { project: 'Acme Commerce', drawnBy: '', date: today(), rev: 'A' }, settings: { ...DEFAULT_SETTINGS }, sheets: [s1, s2, s3], active: 's1' };
}

// ---------- validation: every document that comes from storage or a file goes through here
const num = v => typeof v === 'number' && Number.isFinite(v);
const str = (v, d = '') => (typeof v === 'string' ? v : typeof v === 'number' ? String(v) : d);
const oneOf = (v, list, d) => (list.includes(v) ? v : d);

function cleanNode(n, ids) {
  if (!n || typeof n !== 'object') return null;
  const type = n.type;
  if (!SHAPES[type] && type !== 'path' && type !== 'line') return null;
  if (![n.x, n.y, n.w, n.h].every(num)) return null;
  let id = str(n.id);
  if (!id || ids.has(id)) id = uid();
  ids.add(id);
  const out = {
    id, type, x: n.x, y: n.y, w: Math.max(0, n.w), h: Math.max(0, n.h),
    label: str(n.label), sub: str(n.sub), dashed: !!n.dashed,
    fill: oneOf(n.fill, ['none', 'tint', 'hatch'], 'none'),
    size: oneOf(n.size, ['s', 'm', 'l'], type === 'zone' ? 's' : 'm'),
    flip: !!n.flip
  };
  if (type === 'path' || type === 'line') {
    const pts = Array.isArray(n.pts) ? n.pts.filter(p => Array.isArray(p) && num(p[0]) && num(p[1])).map(p => [p[0], p[1]]) : [];
    if (pts.length < 2) return null;
    out.pts = type === 'line' ? pts.slice(0, 2) : pts;
    out.weight = oneOf(n.weight, ['s', 'm', 'l'], type === 'line' ? 'm' : 's');
  }
  return out;
}
function cleanEdge(e, nodeIds, ids) {
  if (!e || typeof e !== 'object') return null;
  const from = str(e.from), to = str(e.to);
  if (!nodeIds.has(from) || !nodeIds.has(to) || from === to) return null;
  let id = str(e.id);
  if (!id || ids.has(id)) id = uid();
  ids.add(id);
  return { id, from, to, label: str(e.label), route: oneOf(e.route, ROUTES, 'elbow'), arrow: oneOf(e.arrow, ['none', 'end', 'both'], 'end'), dashed: !!e.dashed };
}
export function cleanSheet(s, sheetIds, fallbackNumber) {
  if (!s || typeof s !== 'object') return null;
  // Node and edge ids share one namespace, because the selection holds both.
  const ids = new Set();
  const nodes = (Array.isArray(s.nodes) ? s.nodes : []).map(n => cleanNode(n, ids)).filter(Boolean);
  const nodeIds = new Set(nodes.map(n => n.id));
  const edges = (Array.isArray(s.edges) ? s.edges : []).map(e => cleanEdge(e, nodeIds, ids)).filter(Boolean);
  let id = str(s.id);
  if (!id || sheetIds.has(id)) id = uid();
  sheetIds.add(id);
  const v = s.view;
  return {
    id, number: str(s.number, fallbackNumber) || fallbackNumber, name: str(s.name, 'Untitled sheet'),
    unit: oneOf(s.unit, UNITS, 'px'),
    view: v && num(v.x) && num(v.y) && num(v.k) && v.k > 0 ? { x: v.x, y: v.y, k: v.k } : null,
    nodes, edges
  };
}
export function cleanSettings(raw) {
  const s = raw && typeof raw === 'object' ? raw : {};
  return {
    lettering: oneOf(s.lettering, ['hand', 'technical'], DEFAULT_SETTINGS.lettering),
    caps: typeof s.caps === 'boolean' ? s.caps : DEFAULT_SETTINGS.caps,
    grid: oneOf(Number(s.grid), GRIDS, DEFAULT_SETTINGS.grid),
    route: oneOf(s.route, ROUTES, DEFAULT_SETTINGS.route)
  };
}
// Returns a valid document, or null when the input is not a Ferroprint project.
export function cleanDoc(raw) {
  if (!raw || typeof raw !== 'object' || !Array.isArray(raw.sheets)) return null;
  const sheetIds = new Set();
  const sheets = raw.sheets.map((s, i) => cleanSheet(s, sheetIds, 'A-' + (101 + i))).filter(Boolean);
  if (!sheets.length) return null;
  const m = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
  return {
    meta: { project: str(m.project), drawnBy: str(m.drawnBy), date: str(m.date), rev: str(m.rev) },
    settings: cleanSettings(raw.settings),
    sheets,
    active: sheets.some(s => s.id === raw.active) ? raw.active : sheets[0].id
  };
}

// ---------- export
export async function fontCSS(L, cache) {
  if (cache[L.css] != null) return cache[L.css];
  let out = '';
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?${L.css}&family=IBM+Plex+Mono:wght@400&display=swap`)).text();
    const blocks = css.split('@font-face').slice(1).map(b => '@font-face' + b.split('/*')[0]).filter(b => b.indexOf('U+0000-00FF') >= 0);
    for (const b of blocks) {
      const m = b.match(/url\((https:[^)]+)\)/);
      if (!m) continue;
      const blob = await (await fetch(m[1])).blob();
      const data = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(blob); });
      out += b.replace(m[1], data) + '\n';
    }
  } catch {
    out = '';
  }
  cache[L.css] = out;
  return out;
}
export function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}

#!/usr/bin/env node
// Builds the cloud icon sets in public/cloud/ from the official icon packages of AWS, Azure,
// Google Cloud and Alibaba Cloud. Each icon becomes ink line art in the Ferroprint style:
// outlines, ink fills and a light second tone. The vendor colors are not kept.
//
// Run: npm run icons
// Needs: curl, unzip and git. Downloads go to .icon-cache/, which git ignores.
import { optimize } from 'svgo';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const CACHE = path.join(ROOT, '.icon-cache');
const OUT = path.join(ROOT, 'public', 'cloud');

const SOURCES = {
  aws: { zip: 'https://d1.awsstatic.com/onedam/marketing-channels/website/public/shared/architecture-icon-release/Icon-package_07312026.5846e92413caa21490223536cc97f1269e44fa92.zip' },
  azure: { zip: 'https://arch-center.azureedge.net/icons/Azure_Public_Service_Icons_V24.zip' },
  gcp: { zip: 'https://cloud.google.com/static/icons/files/google-cloud-icons.zip' },
  'gcp-core': { zip: 'https://services.google.com/fh/files/misc/core-products-icons.zip' },
  'gcp-category': { zip: 'https://services.google.com/fh/files/misc/category-icons.zip' },
  alibaba: { git: 'https://github.com/mcsrainbow/alibaba-cloud-icons.git', sparse: '2022-orange/icons/en' }
};

// ---------- download
function fetchSource(id) {
  const src = SOURCES[id], dir = path.join(CACHE, id);
  if (fs.existsSync(dir)) return dir;
  fs.mkdirSync(CACHE, { recursive: true });
  if (src.zip) {
    const zip = dir + '.zip';
    console.log(`download ${id}`);
    execFileSync('curl', ['-sSfL', '-o', zip, src.zip]);
    execFileSync('unzip', ['-q', '-o', zip, '-d', dir]);
  } else {
    console.log(`clone ${id}`);
    execFileSync('git', ['clone', '-q', '--depth', '1', '--filter=blob:none', '--sparse', src.git, dir]);
    execFileSync('git', ['-C', dir, 'sparse-checkout', 'set', src.sparse]);
  }
  return dir;
}
const walkFiles = dir => fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => {
  const p = path.join(dir, e.name);
  if (e.name === '__MACOSX' || e.name.startsWith('.')) return [];
  return e.isDirectory() ? walkFiles(p) : [p];
});

// ---------- colors
const NAMED = { white: [255, 255, 255], black: [0, 0, 0], gray: [128, 128, 128], grey: [128, 128, 128], red: [255, 0, 0], blue: [0, 0, 255], green: [0, 128, 0] };
function parseColor(v) {
  if (!v) return null;
  v = v.trim().toLowerCase();
  if (NAMED[v]) return NAMED[v];
  let m = v.match(/^#([0-9a-f]{3})$/);
  if (m) return [...m[1]].map(c => parseInt(c + c, 16));
  m = v.match(/^#([0-9a-f]{6})/);
  if (m) return [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16));
  m = v.match(/^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/);
  if (m) return [m[1], m[2], m[3]].map(Number);
  return null;
}
const lightness = c => (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255;
const nearWhite = c => Math.min(...c) >= 232;

// ---------- geometry
const num = (v, d = 0) => { const n = parseFloat(v); return Number.isFinite(n) ? n : d; };
const r2 = v => Math.round(v * 100) / 100;
function shapePath(node) {
  const a = node.attributes;
  switch (node.name) {
    case 'path': return a.d || null;
    case 'rect': {
      const x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height);
      if (w <= 0 || h <= 0) return null;
      let rx = a.rx != null ? num(a.rx) : a.ry != null ? num(a.ry) : 0, ry = a.ry != null ? num(a.ry) : rx;
      rx = Math.min(rx, w / 2); ry = Math.min(ry, h / 2);
      if (!rx || !ry) return `M${r2(x)} ${r2(y)}h${r2(w)}v${r2(h)}h${r2(-w)}z`;
      return `M${r2(x + rx)} ${r2(y)}h${r2(w - 2 * rx)}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(rx)} ${r2(ry)}v${r2(h - 2 * ry)}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(-rx)} ${r2(ry)}h${r2(-(w - 2 * rx))}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(-rx)} ${r2(-ry)}v${r2(-(h - 2 * ry))}a${r2(rx)} ${r2(ry)} 0 0 1 ${r2(rx)} ${r2(-ry)}z`;
    }
    case 'circle': case 'ellipse': {
      const cx = num(a.cx), cy = num(a.cy), rx = num(node.name === 'circle' ? a.r : a.rx), ry = num(node.name === 'circle' ? a.r : a.ry);
      if (rx <= 0 || ry <= 0) return null;
      return `M${r2(cx - rx)} ${r2(cy)}a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(2 * rx)} 0a${r2(rx)} ${r2(ry)} 0 1 0 ${r2(-2 * rx)} 0z`;
    }
    case 'line': return `M${r2(num(a.x1))} ${r2(num(a.y1))}L${r2(num(a.x2))} ${r2(num(a.y2))}`;
    case 'polyline': case 'polygon': {
      const p = (a.points || '').trim().split(/[\s,]+/).map(Number).filter(Number.isFinite);
      if (p.length < 4) return null;
      let d = `M${r2(p[0])} ${r2(p[1])}`;
      for (let i = 2; i + 1 < p.length; i += 2) d += `L${r2(p[i])} ${r2(p[i + 1])}`;
      return node.name === 'polygon' ? d + 'z' : d;
    }
    default: return null;
  }
}

// ---------- shape metrics
// Flattens path data into polygons. Curves and arcs become short straight segments.
function flatten(d) {
  const polys = [];
  let i = 0, cmd = '', cur = [0, 0], start = [0, 0], prevCtrl = null, poly = null;
  const ws = () => { while (i < d.length && /[\s,]/.test(d[i])) i++; };
  const number = () => { ws(); const m = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(d.slice(i)); if (!m) return null; i += m[0].length; return parseFloat(m[0]); };
  const flag = () => { ws(); const c = d[i]; if (c === '0' || c === '1') { i++; return c === '1'; } return null; };
  const add = p => { if (!poly) { poly = [cur.slice()]; polys.push(poly); } poly.push(p); cur = p; };
  const bez = (pts, n = 8) => { for (let k = 1; k <= n; k++) { const t = k / n, u = 1 - t; add(pts.length === 3 ? [u * u * pts[0][0] + 2 * u * t * pts[1][0] + t * t * pts[2][0], u * u * pts[0][1] + 2 * u * t * pts[1][1] + t * t * pts[2][1]] : [u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0], u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1]]); } };
  const arc = (rx, ry, rot, large, sweep, x, y) => {
    const [x1, y1] = cur;
    if (!rx || !ry) { add([x, y]); return; }
    const phi = (rot * Math.PI) / 180, cp = Math.cos(phi), sp = Math.sin(phi);
    const dx = (x1 - x) / 2, dy = (y1 - y) / 2, x1p = cp * dx + sp * dy, y1p = -sp * dx + cp * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    const lam = (x1p * x1p) / (rx * rx) + (y1p * y1p) / (ry * ry);
    if (lam > 1) { rx *= Math.sqrt(lam); ry *= Math.sqrt(lam); }
    const num = rx * rx * ry * ry - rx * rx * y1p * y1p - ry * ry * x1p * x1p, den = rx * rx * y1p * y1p + ry * ry * x1p * x1p;
    const co = (large === sweep ? -1 : 1) * Math.sqrt(Math.max(0, num / den));
    const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx;
    const cx = cp * cxp - sp * cyp + (x1 + x) / 2, cy = sp * cxp + cp * cyp + (y1 + y) / 2;
    const ang = (ux, uy, vx, vy) => Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy);
    const t1 = ang(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry);
    let dt = ang((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry);
    if (!sweep && dt > 0) dt -= 2 * Math.PI; else if (sweep && dt < 0) dt += 2 * Math.PI;
    const n = Math.max(4, Math.ceil(Math.abs(dt) / (Math.PI / 8)));
    for (let k = 1; k <= n; k++) { const t = t1 + (dt * k) / n; add([cx + rx * Math.cos(t) * cp - ry * Math.sin(t) * sp, cy + rx * Math.cos(t) * sp + ry * Math.sin(t) * cp]); }
  };
  while (i < d.length) {
    ws();
    if (i >= d.length) break;
    if (/[a-zA-Z]/.test(d[i])) cmd = d[i++];
    const rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase(), o = rel ? cur : [0, 0];
    if (C === 'Z') { if (poly) poly.push(start.slice()); cur = start.slice(); poly = null; prevCtrl = null; continue; }
    if (C === 'M') { const x = number(), y = number(); if (y == null) break; cur = [o[0] + x, o[1] + y]; start = cur.slice(); poly = null; cmd = rel ? 'l' : 'L'; prevCtrl = null; continue; }
    if (C === 'L') { const x = number(), y = number(); if (y == null) break; add([o[0] + x, o[1] + y]); prevCtrl = null; }
    else if (C === 'H') { const x = number(); if (x == null) break; add([rel ? cur[0] + x : x, cur[1]]); prevCtrl = null; }
    else if (C === 'V') { const y = number(); if (y == null) break; add([cur[0], rel ? cur[1] + y : y]); prevCtrl = null; }
    else if (C === 'C') { const v = [number(), number(), number(), number(), number(), number()]; if (v[5] == null) break; const p1 = [o[0] + v[0], o[1] + v[1]], p2 = [o[0] + v[2], o[1] + v[3]], p3 = [o[0] + v[4], o[1] + v[5]]; bez([cur.slice(), p1, p2, p3]); prevCtrl = p2; }
    else if (C === 'S') { const v = [number(), number(), number(), number()]; if (v[3] == null) break; const p1 = prevCtrl ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]] : cur.slice(); const p2 = [o[0] + v[0], o[1] + v[1]], p3 = [o[0] + v[2], o[1] + v[3]]; bez([cur.slice(), p1, p2, p3]); prevCtrl = p2; }
    else if (C === 'Q') { const v = [number(), number(), number(), number()]; if (v[3] == null) break; const p1 = [o[0] + v[0], o[1] + v[1]], p2 = [o[0] + v[2], o[1] + v[3]]; bez([cur.slice(), p1, p2]); prevCtrl = p1; }
    else if (C === 'T') { const v = [number(), number()]; if (v[1] == null) break; const p1 = prevCtrl ? [2 * cur[0] - prevCtrl[0], 2 * cur[1] - prevCtrl[1]] : cur.slice(); bez([cur.slice(), p1, [o[0] + v[0], o[1] + v[1]]]); prevCtrl = p1; }
    else if (C === 'A') { const rx = number(), ry = number(), rot = number(), lg = flag(), sw = flag(), x = number(), y = number(); if (y == null) break; arc(rx, ry, rot, lg, sw, o[0] + x, o[1] + y); prevCtrl = null; }
    else break;
  }
  return polys.filter(p => p.length > 2);
}
const polyArea = p => { let a = 0; for (let k = 0; k < p.length; k++) { const [x1, y1] = p[k], [x2, y2] = p[(k + 1) % p.length]; a += x1 * y2 - x2 * y1; } return Math.abs(a) / 2; };
const polyLen = p => { let l = 0; for (let k = 0; k < p.length; k++) { const [x1, y1] = p[k], [x2, y2] = p[(k + 1) % p.length]; l += Math.hypot(x2 - x1, y2 - y1); } return l; };
const inside = (pt, p) => { let c = false; for (let k = 0, j = p.length - 1; k < p.length; j = k++) { const [xi, yi] = p[k], [xj, yj] = p[j]; if ((yi > pt[1]) !== (yj > pt[1]) && pt[0] < ((xj - xi) * (pt[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
// Average thickness of a filled shape: 2 × area ÷ perimeter. A nested contour counts as a hole.
function thickness(d) {
  const polys = flatten(d).map(p => ({ p, a: polyArea(p) })).sort((x, y) => y.a - x.a);
  let area = 0, perim = 0;
  polys.forEach((q, k) => {
    const depth = polys.slice(0, k).filter(o => inside(q.p[0], o.p)).length;
    area += (depth % 2 ? -1 : 1) * q.a;
    perim += polyLen(q.p);
  });
  return perim ? (2 * Math.max(0, area)) / perim : 0;
}

// ---------- conversion
const SKIP = new Set(['defs', 'clipPath', 'mask', 'symbol', 'title', 'desc', 'style', 'linearGradient', 'radialGradient', 'pattern', 'filter', 'metadata', 'text', 'image']);

// Turns one SVG into { v: viewBox, p: [[mode, d, transform, evenodd, strokeWidth]] }.
// Modes: o = outline, f = ink fill, l = light fill, s = ink stroke.
function convert(svgText, classify) {
  const vbm = svgText.match(/viewBox="([^"]+)"/);
  const wm = svgText.match(/<svg[^>]*\swidth="([\d.]+)/), hm = svgText.match(/<svg[^>]*\sheight="([\d.]+)/);
  const vb = vbm ? vbm[1].trim().split(/[\s,]+/).map(Number) : [0, 0, num(wm && wm[1], 24), num(hm && hm[1], 24)];
  const precision = Math.max(0, Math.min(3, Math.ceil(Math.log10(400 / Math.max(vb[2], vb[3])))));
  let out = null;
  const extract = {
    name: 'extractFerroprint',
    fn: () => ({
      root: {
        enter(root) {
          const ids = {}, grads = {};
          const index = n => { if (n.attributes && n.attributes.id) ids[n.attributes.id] = n; (n.children || []).forEach(index); };
          index(root);
          const gradColor = id => {
            const g = ids[id];
            if (!g) return null;
            let stops = (g.children || []).filter(c => c.name === 'stop');
            const href = g.attributes.href || g.attributes['xlink:href'];
            if (!stops.length && href) return gradColor(href.replace(/^#/, ''));
            const cs = stops.map(s => parseColor(s.attributes['stop-color'] || 'black')).filter(Boolean);
            if (!cs.length) return null;
            return [0, 1, 2].map(i => cs.reduce((t, c) => t + c[i], 0) / cs.length);
          };
          const colorOf = v => {
            if (!v || v === 'none' || v === 'transparent') return null;
            const m = v.match(/url\(#([^)]+)\)/);
            return m ? (grads[m[1]] ??= gradColor(m[1])) : parseColor(v);
          };
          const items = [];
          const walk = (node, st) => {
            if (node.type !== 'element' || SKIP.has(node.name)) return;
            const a = node.attributes;
            if (a.display === 'none' || a.visibility === 'hidden') return;
            const s = { ...st };
            ['fill', 'stroke', 'fill-rule', 'stroke-width'].forEach(k => { if (a[k] != null) s[k] = a[k]; });
            s.opacity = st.opacity * num(a.opacity, 1);
            s.fillOpacity = num(a['fill-opacity'], st.fillOpacity);
            if (a.transform) s.t = (st.t ? st.t + ' ' : '') + a.transform;
            if (node.name === 'use') {
              const ref = ids[(a.href || a['xlink:href'] || '').replace(/^#/, '')];
              if (ref) walk(ref, { ...s, t: (s.t ? s.t + ' ' : '') + `translate(${num(a.x)} ${num(a.y)})` });
              return;
            }
            const d = shapePath(node);
            if (d) {
              if (s.opacity < 0.3) return;
              const fill = node.name === 'line' || node.name === 'polyline' ? null : colorOf(s.fill);
              const stroke = colorOf(s.stroke);
              const bg = node.name === 'rect' && num(a.width) >= vb[2] * 0.95 && num(a.height) >= vb[3] * 0.95;
              const ev = s['fill-rule'] === 'evenodd' ? 1 : 0;
              if (fill && s.fillOpacity * s.opacity >= 0.3) {
                const thick = thickness(d) / Math.max(vb[2], vb[3]);
                items.push([classify({ fill, bg, thick, opacity: s.opacity * s.fillOpacity }), d, s.t || '', ev]);
              }
              if (stroke) items.push(['s', d, s.t || '', 0, num(s['stroke-width'], 1)]);
              return;
            }
            (node.children || []).forEach(c => walk(c, s));
          };
          const svg = root.children.find(c => c.name === 'svg');
          if (svg) walk(svg, { fill: 'black', stroke: 'none', 'fill-rule': 'nonzero', opacity: 1, fillOpacity: 1, t: '' });
          out = items;
        }
      }
    })
  };
  optimize(svgText, {
    multipass: false,
    plugins: [
      'removeDoctype', 'removeXMLProcInst', 'removeComments', 'removeMetadata', 'removeEditorsNSData',
      { name: 'inlineStyles', params: { onlyMatchedOnce: false } },
      'convertStyleToAttrs',
      { name: 'convertPathData', params: { floatPrecision: precision, applyTransforms: true } },
      { name: 'convertTransform', params: { floatPrecision: precision } },
      extract
    ]
  });
  // Trailing defaults are left out, so the files stay small.
  const p = (out || []).map(it => {
    const x = it.slice();
    while (x.length > 2 && !x[x.length - 1]) x.pop();
    return x;
  });
  return p.length ? { v: vb.map(r2), p } : null;
}

// ---------- names
const ACRONYMS = new Set(['ai', 'api', 'apis', 'iot', 'sql', 'gke', 'vpc', 'dns', 'cdn', 'nat', 'ml', 'tpu', 'gpu', 'iam', 'kms', 'vm', 'vms', 'bi', 'dlp', 'os', 'hpc', 'ids', 'waf', 'ssl', 'tls', 'sap', 'ec2', 'rds', 'ebs', 'efs', 'ecs', 'eks', 'ecr', 'emr', 'sns', 'sqs', 'ses', 'iq', 'hsm', 'vpn', 'url', 'ssh', 'ha', 'ar', 'vr', 'nfs', 'smb', 'cli', 'sdk', 'ide', 'dms', 'fsx', 'msk', 'mq', 'ram', 'acm', 'kvs', 'oss', 'ecs', 'slb', 'nas', 'rpa']);
const SPECIAL = { bigquery: 'BigQuery', bigtable: 'Bigtable', alloydb: 'AlloyDB', automl: 'AutoML', pubsub: 'Pub/Sub', firestore: 'Firestore', dataproc: 'Dataproc', datastream: 'Datastream', looker: 'Looker', apigee: 'Apigee', anthos: 'Anthos', dialogflow: 'Dialogflow', memorystore: 'Memorystore', filestore: 'Filestore', datastore: 'Datastore', dataflow: 'Dataflow', dataplex: 'Dataplex', datalab: 'Datalab', dataprep: 'Dataprep', cloudsql: 'Cloud SQL', vertexai: 'Vertex AI' };
const titleWords = s => s.split(/[\s_]+/).filter(Boolean).map(w => {
  const l = w.toLowerCase();
  if (SPECIAL[l]) return SPECIAL[l];
  if (ACRONYMS.has(l)) return l.toUpperCase();
  return /[A-Z]/.test(w.slice(1)) ? w : l.charAt(0).toUpperCase() + l.slice(1);
}).join(' ');
const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

// ---------- provider builders
function makeSet(id, name, source) {
  const set = { id, name, source, groups: [], icons: {} }, byName = {}, groupIx = {};
  set.add = (group, iconName, file, classify) => {
    let key = byName[iconName];
    if (!key) {
      const icon = convert(fs.readFileSync(file, 'utf8'), classify);
      if (!icon) return;
      key = slug(iconName);
      for (let i = 2; set.icons[key]; i++) key = slug(iconName) + '-' + i;
      set.icons[key] = { n: iconName, ...icon };
      byName[iconName] = key;
    }
    if (groupIx[group] == null) { groupIx[group] = set.groups.length; set.groups.push({ n: group, i: [] }); }
    const g = set.groups[groupIx[group]];
    if (!g.i.includes(key)) g.i.push(key);
  };
  return set;
}

// A shape thicker than this share of the icon size is an area, not a line, so it becomes an outline.
const SOLID = 0.1;

// AWS: a colored square behind a white glyph. The square becomes an outline and the glyph becomes ink.
const awsClassify = ({ bg, thick }) => (bg || thick > SOLID ? 'o' : 'f');
function buildAws() {
  const dir = fetchSource('aws'), files = walkFiles(dir).filter(f => f.endsWith('.svg'));
  const set = makeSet('aws', 'AWS', 'AWS Architecture Icons, release 2026-07-31');
  const groupName = s => titleWords(s.replace(/^(Arch|Res)_/, '').replace(/-/g, ' ')).replace(/ And /g, ' and ');
  const svcName = f => path.basename(f, '.svg').replace(/^(Arch|Res)_/, '').replace(/_(16|32|48|64)(_(Light|Dark))?$/, '').replace(/[-_]+/g, ' ').trim();
  const services = files.filter(f => /Architecture-Service-Icons/.test(f) && /\/64\//.test(f));
  const resources = files.filter(f => /Resource-Icons/.test(f) && !/_Dark\.svg$/.test(f) && !/Res_48_Dark/.test(f));
  services.sort().forEach(f => set.add(groupName(path.basename(path.dirname(path.dirname(f)))), svcName(f), f, awsClassify));
  resources.sort().forEach(f => {
    const folder = f.split(path.sep).find(p => /^Res_/.test(p) && !/^Res_48_/.test(p) && !p.endsWith('.svg'));
    const group = folder === 'Res_General-Icons' ? 'General' : groupName(folder);
    set.add(group, svcName(f), f, awsClassify);
  });
  files.filter(f => /Category-Icons/.test(f) && /_64\.svg$/.test(f)).sort()
    .forEach(f => set.add('Categories', titleWords(path.basename(f, '.svg').replace(/^Arch-Category_/, '').replace(/_64$/, '').replace(/-/g, ' ')).replace(/ And /g, ' and ') + ' (category)', f, awsClassify));
  files.filter(f => /Architecture-Group-Icons/.test(f)).sort()
    .forEach(f => set.add('Groups', path.basename(f, '.svg').replace(/_(16|32|48|64)(_(Light|Dark))?$/, '').replace(/[-_]+/g, ' ') + ' (group)', f, awsClassify));
  return set;
}

// Azure: flat colored shapes with white details. Colored shapes become outlines and thin white details become ink.
const azureClassify = ({ fill, thick }) => (nearWhite(fill) && thick <= SOLID ? 'f' : 'o');
function buildAzure() {
  const dir = fetchSource('azure'), files = walkFiles(dir).filter(f => f.endsWith('.svg'));
  const set = makeSet('azure', 'Azure', 'Azure Public Service Icons V24');
  files.sort().forEach(f => {
    const folder = path.basename(path.dirname(f));
    const group = folder.split(' ').map(w => (ACRONYMS.has(w) ? w.toUpperCase() : w === '+' ? '+' : w.charAt(0).toUpperCase() + w.slice(1))).join(' ');
    const name = path.basename(f, '.svg').replace(/^\d+-icon-service-/, '').replace(/[-_]+/g, ' ').trim();
    set.add(group, name, f, azureClassify);
  });
  set.groups.sort((a, b) => (a.n === 'General') - (b.n === 'General') || a.n.localeCompare(b.n));
  return set;
}

// Google Cloud: thick strokes in two or three tones. Solid areas become outlines, dark strokes become ink
// and light strokes become a light fill.
const gcpClassify = ({ fill, thick }) => (thick > 0.05 ? 'o' : lightness(fill) >= 0.72 ? 'l' : 'f');
const GCP_GROUPS = [
  ['AI and Machine Learning', /\b(ai|ml|automl|vertex|dialogflow|vision|speech|translat|natural language|video intelligence|recommendation|document ai|contact center|agent|tpu|notebook|datalab|gemini|jobs api|talent|healthcare nlp|tensorflow|advanced solutions|predict)/],
  ['Databases', /\b(sql|spanner|bigtable|firestore|datastore|memorystore|alloydb|database)/],
  ['Data Analytics', /\b(bigquery|dataflow|dataproc|pub\/sub|pubsub|composer|data ?fusion|dataprep|dataplex|datastream|looker|analytics|data catalog|genomics|life sciences|data studio|data transfer|data qna|dataform|data labeling)/],
  ['Storage', /\b(storage|filestore|persistent disk|transfer|backup|archive|hyperdisk|local ssd)/],
  ['Networking', /\b(network|vpc|dns|cdn|load balanc|nat|interconnect|vpn|router|armor|ids|traffic|service directory|private service|partner interconnect|premium tier|standard tier|external ip|firewall|routes|cloud domains)/],
  ['Security and Identity', /\b(security|iam|identity|kms|key|secret|dlp|data loss|certificate|beyondcorp|access|assured|binary authorization|web risk|recaptcha|chronicle|mandiant|threat|shielded|confidential|policy|risk manager)/],
  ['Compute', /\b(compute|engine|gpu|vm|instance|bare metal|batch|sole|os |container optimized|preemptible|tpu|hpc)/],
  ['Containers and Serverless', /\b(gke|kubernetes|container|run|functions|app engine|cloud build|artifact|registry|workflows|scheduler|tasks|eventarc|api gateway|endpoints)/],
  ['Hybrid and Multicloud', /\b(anthos|distributed|migrate|migration|vmware|bare metal|edge)/],
  ['Operations and Management', /\b(monitoring|logging|trace|debugger|profiler|error|operations|deployment manager|console|shell|billing|cost|asset|resource manager|config|admin|apis|quotas|recommender|launcher|marketplace|support|status|healthcare)/],
  ['Developer Tools', /\b(source|debug|deploy|code|sdk|test lab|tools|ide|api)/],
  ['Integration and APIs', /\b(apigee|integration|connectors|application integration|maps|iot|workspace)/]
];
function buildGcp() {
  const set = makeSet('gcp', 'Google Cloud', 'Google Cloud icons, core product icons and category icons');
  const core = walkFiles(fetchSource('gcp-core')).filter(f => /\/SVG\//.test(f) && /-color(-rgb)?\.svg$/.test(f));
  const byProduct = {};
  core.forEach(f => { const p = f.split(path.sep).slice(-3)[0]; if (!byProduct[p] || /-rgb\.svg$/.test(f)) byProduct[p] = f; });
  Object.keys(byProduct).sort().forEach(p => set.add('Core products', p, byProduct[p], gcpClassify));
  walkFiles(fetchSource('gcp')).filter(f => f.endsWith('.svg')).sort().forEach(f => {
    const name = titleWords(path.basename(f, '.svg').replace(/_/g, ' '));
    const low = name.toLowerCase();
    const g = (GCP_GROUPS.find(([, re]) => re.test(low)) || ['Other products'])[0];
    set.add(g, name, f, gcpClassify);
  });
  walkFiles(fetchSource('gcp-category')).filter(f => /\/SVG\//.test(f) && /-color(-rgb)?\.svg$/.test(f)).sort().forEach(f => {
    const cat = f.split(path.sep).slice(-3)[0].replace(/ _ /g, ' and ').replace(/&/g, 'and');
    set.add('Categories', cat + ' (category)', f, gcpClassify);
  });
  const order = ['Core products', ...GCP_GROUPS.map(g => g[0]), 'Other products', 'Categories'];
  set.groups.sort((a, b) => order.indexOf(a.n) - order.indexOf(b.n));
  return set;
}

// Alibaba Cloud: orange glyphs on a clear background. Thin glyph strokes become ink and solid areas become outlines.
const aliClassify = ({ thick }) => (thick > 0.05 ? 'o' : 'f');
function buildAlibaba() {
  const dir = path.join(fetchSource('alibaba'), '2022-orange', 'icons', 'en');
  const set = makeSet('alibaba', 'Alibaba Cloud', 'Alibaba Cloud Design Center icons, 2022 orange set');
  walkFiles(dir).filter(f => f.endsWith('.svg') && !/00 Logo/.test(f)).sort().forEach(f => {
    const group = path.basename(path.dirname(f)).replace(/^\d+\s+/, '');
    set.add(group, path.basename(f, '.svg').trim(), f, aliClassify);
  });
  return set;
}

// ---------- write
fs.mkdirSync(OUT, { recursive: true });
// Pass provider ids to build only those sets, for example: npm run icons -- aws azure
const BUILDERS = { aws: buildAws, azure: buildAzure, gcp: buildGcp, alibaba: buildAlibaba };
const only = process.argv.slice(2);
for (const [id, build] of Object.entries(BUILDERS)) {
  if (only.length && !only.includes(id)) continue;
  const set = build();
  delete set.add;
  const file = path.join(OUT, set.id + '.json');
  fs.writeFileSync(file, JSON.stringify(set));
  console.log(`${set.id}: ${Object.keys(set.icons).length} icons in ${set.groups.length} groups, ${(fs.statSync(file).size / 1024).toFixed(0)} KB`);
}

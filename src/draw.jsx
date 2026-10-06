// Pure SVG drawing for shapes, connectors and dimension marks.
// `ctx` holds the theme (t), the lettering (L), the caps flag, the sheet unit and the grid size.
import { SIZES, WEIGHTS, MONO, measure, wrap, linePts, edgeGeom, areaLabel, fmtLen, f1 } from './engine.js';

export const txt = (ctx, s) => (ctx.caps ? String(s).toUpperCase() : String(s));

function labelEls(n, ctx, o) {
  const { t, L } = ctx;
  const fs = SIZES[n.size || 'm'] * (o.scale || 1), lsp = L.ls * fs, font = `${L.weight} ${fs}px ${L.family}`;
  const str = n.label ? txt(ctx, n.label) : '';
  let lines = str ? wrap(str, Math.max(20, o.maxW), font, lsp) : [];
  if (o.maxLines) lines = lines.slice(0, o.maxLines);
  const sub = o.sub !== undefined ? o.sub : n.sub, sfs = Math.max(10, Math.round(fs * 0.7));
  const lh = fs * L.lh, total = lines.length * lh + (sub ? sfs * 1.6 : 0);
  const y0 = o.top != null ? o.top : o.cy - total / 2, anchor = o.anchor || 'middle';
  const els = lines.map((ln, i) => (
    <text key={'l' + i} x={o.x} y={y0 + lh * i + lh / 2} textAnchor={anchor} dominantBaseline="central" fill={o.color || t.ink} fontFamily={L.family} fontWeight={L.weight} fontSize={fs} letterSpacing={lsp}>{ln}</text>
  ));
  if (sub) els.push(<text key="sub" x={o.x} y={y0 + lines.length * lh + sfs * 0.95} textAnchor={anchor} dominantBaseline="central" fill={t.muted} fontFamily={MONO} fontSize={sfs}>{sub}</text>);
  return els;
}

export function renderNode(n, ctx) {
  const { t, L } = ctx;
  const { x, y, w } = n, hh = n.h, cx = x + w / 2, cy = y + hh / 2;
  const fill = n.fill === 'tint' ? t.tint : n.fill === 'hatch' ? 'url(#fp-hatch)' : 'none';
  const dash = n.dashed ? (n.type === 'zone' ? '10 6' : '7 5') : undefined;
  const S = { stroke: t.ink, strokeWidth: 1.6, fill, strokeDasharray: dash, strokeLinejoin: 'miter' };
  const hit = <rect key="hit" x={x} y={y} width={Math.max(w, 1)} height={Math.max(hh, 1)} fill="transparent" />;
  const lab = o => labelEls(n, ctx, { x: cx, cy, maxW: w - 20, ...o });
  const k = [];
  switch (n.type) {
    case 'box': k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} />, ...lab()); break;
    case 'service': k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} rx={Math.min(12, hh / 2)} />, ...lab()); break;
    case 'terminal': k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} rx={hh / 2} />, ...lab({ maxW: w - hh * 0.6 })); break;
    case 'button': k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} rx={6} />, ...lab({ maxW: w - 16 })); break;
    case 'room': k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} strokeWidth={5} />, ...lab({ sub: n.sub || areaLabel(n, ctx.unit, ctx.g) })); break;
    case 'database': {
      const e = Math.min(14, hh * 0.16, w * 0.25), rx = w / 2;
      k.push(
        hit,
        <path key="s" {...S} d={`M${x} ${y + e} A${rx} ${e} 0 0 1 ${x + w} ${y + e} V${y + hh - e} A${rx} ${e} 0 0 1 ${x} ${y + hh - e} Z`} />,
        <path key="lip" d={`M${x} ${y + e} A${rx} ${e} 0 0 0 ${x + w} ${y + e}`} fill="none" stroke={t.ink} strokeWidth={1.6} strokeDasharray={dash} />,
        ...lab({ cy: y + e + (hh - e) / 2, maxW: w - 16 })
      );
      break;
    }
    case 'queue': {
      const e = Math.min(14, w * 0.15, hh * 0.3), rr = hh / 2;
      k.push(
        hit,
        <path key="s" {...S} d={`M${x + e} ${y} H${x + w - e} A${e} ${rr} 0 0 1 ${x + w - e} ${y + hh} H${x + e} A${e} ${rr} 0 0 1 ${x + e} ${y} Z`} />,
        <path key="lip" d={`M${x + w - e} ${y} A${e} ${rr} 0 0 0 ${x + w - e} ${y + hh}`} fill="none" stroke={t.ink} strokeWidth={1.6} strokeDasharray={dash} />,
        ...lab({ x: x + (w - e) / 2, maxW: w - e * 3 - 8 })
      );
      break;
    }
    case 'actor': {
      const r = Math.min(w, hh) * 0.17, hy = y + r + 1, neck = hy + r, hip = y + hh * 0.62, arm = neck + hh * 0.1;
      k.push(
        <rect key="hit" x={x - 20} y={y} width={w + 40} height={hh + 30} fill="transparent" />,
        <circle key="hd" {...S} cx={cx} cy={hy} r={r} />,
        <path key="b" d={`M${cx} ${neck} V${hip} M${x + w * 0.08} ${arm} H${x + w * 0.92} M${cx} ${hip} L${x + w * 0.15} ${y + hh} M${cx} ${hip} L${x + w * 0.85} ${y + hh}`} fill="none" stroke={t.ink} strokeWidth={1.6} strokeDasharray={dash} strokeLinecap="round" />,
        ...lab({ top: y + hh + 6, maxW: Math.max(140, w * 2) })
      );
      break;
    }
    case 'zone': {
      const fs = SIZES[n.size || 's'] * 0.95, str = n.label ? txt(ctx, n.label) : '', font = `${L.weight} ${fs}px ${L.family}`;
      const tw = str ? Math.min(w, measure(str, font) + str.length * L.ls * fs + 24) : 0, th = 26;
      k.push(
        <rect key="hs" x={x} y={y} width={w} height={hh} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" />,
        <rect key="s" {...S} x={x} y={y} width={w} height={hh} pointerEvents="none" />
      );
      if (str) {
        k.push(
          <rect key="tab" x={x} y={y} width={tw} height={th} fill={t.paper} stroke={t.ink} strokeWidth={1.6} />,
          <text key="tl" x={x + 12} y={y + th / 2 + 1} dominantBaseline="central" fill={t.ink} fontFamily={L.family} fontWeight={L.weight} fontSize={fs} letterSpacing={L.ls * fs}>{str}</text>
        );
      }
      if (n.sub) k.push(<text key="ts" x={x + tw + 10} y={y + th / 2 + 1} dominantBaseline="central" fill={t.muted} fontFamily={MONO} fontSize={11}>{n.sub}</text>);
      break;
    }
    case 'decision': k.push(hit, <path key="s" {...S} d={`M${cx} ${y} L${x + w} ${cy} L${cx} ${y + hh} L${x} ${cy} Z`} />, ...lab({ maxW: w * 0.6 })); break;
    case 'window': {
      const bar = Math.min(28, hh);
      k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} />, <line key="bar" x1={x} y1={y + bar} x2={x + w} y2={y + bar} stroke={t.ink} strokeWidth={1.6} />);
      [14, 28, 42].forEach((dx, i) => k.push(<circle key={'c' + i} cx={x + dx} cy={y + bar / 2} r={4} fill="none" stroke={t.ink} strokeWidth={1.2} />));
      k.push(...lab({ x: x + 58, cy: y + bar / 2, anchor: 'start', maxW: w - 70, maxLines: 1, scale: 0.85, sub: '' }));
      break;
    }
    case 'input': k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} rx={2} />, ...lab({ x: x + 12, anchor: 'start', maxW: w - 24, maxLines: 1, color: t.muted, sub: '' })); break;
    case 'image': {
      k.push(hit, <rect key="s" {...S} x={x} y={y} width={w} height={hh} />, <path key="x" d={`M${x} ${y} L${x + w} ${y + hh} M${x + w} ${y} L${x} ${y + hh}`} stroke={t.line} strokeWidth={1} fill="none" />);
      if (n.label) {
        const fs = SIZES[n.size || 'm'] * 0.85, str = txt(ctx, n.label), tw = measure(str, `${L.weight} ${fs}px ${L.family}`) + str.length * L.ls * fs + 14;
        k.push(<rect key="lb" x={cx - tw / 2} y={cy - fs * 0.85} width={tw} height={fs * 1.7} fill={t.paper} />, ...lab({ scale: 0.85, maxLines: 1, maxW: w, sub: '' }));
      }
      break;
    }
    case 'door':
      k.push(
        hit,
        <g key="d" transform={n.flip ? `translate(${2 * cx} 0) scale(-1 1)` : undefined}>
          <line x1={x} y1={y + hh} x2={x + w} y2={y + hh} stroke={t.paper} strokeWidth={7} />
          <line x1={x} y1={y + hh} x2={x} y2={y} stroke={t.ink} strokeWidth={2.5} />
          <path d={`M${x + w} ${y + hh} A${w} ${hh} 0 0 0 ${x} ${y}`} fill="none" stroke={t.ink} strokeWidth={1} strokeDasharray="4 3" />
        </g>
      );
      break;
    case 'note': {
      const f = Math.min(18, w * 0.2, hh * 0.2);
      k.push(
        hit,
        <path key="s" {...S} d={`M${x} ${y} H${x + w - f} L${x + w} ${y + f} V${y + hh} H${x} Z`} />,
        <path key="f" d={`M${x + w - f} ${y} V${y + f} H${x + w}`} fill="none" stroke={t.ink} strokeWidth={1.6} />,
        ...lab({ x: x + 12, top: y + 12, anchor: 'start', maxW: w - 24 - f * 0.4, scale: 0.9 })
      );
      break;
    }
    case 'path':
    case 'line': {
      const pts = linePts(n), wgt = WEIGHTS[n.weight || 'm'];
      let d;
      if (n.type === 'line' || pts.length < 3) d = 'M' + pts.map(q => `${f1(q.x)} ${f1(q.y)}`).join(' L');
      else {
        d = `M${f1(pts[0].x)} ${f1(pts[0].y)}`;
        for (let i = 1; i < pts.length - 1; i++) d += ` Q${f1(pts[i].x)} ${f1(pts[i].y)} ${f1((pts[i].x + pts[i + 1].x) / 2)} ${f1((pts[i].y + pts[i + 1].y) / 2)}`;
        const lp = pts[pts.length - 1];
        d += ` L${f1(lp.x)} ${f1(lp.y)}`;
      }
      k.push(
        <path key="hit" d={d} fill="none" stroke="transparent" strokeWidth={Math.max(14, wgt + 10)} pointerEvents="stroke" />,
        <path key="s" d={d} fill="none" stroke={t.ink} strokeWidth={wgt} strokeLinecap={n.type === 'line' ? 'square' : 'round'} strokeLinejoin="round" strokeDasharray={n.dashed ? `${wgt * 3} ${wgt * 2.2}` : undefined} />
      );
      break;
    }
    default: k.push(hit, ...lab({ maxW: Math.max(w, 40) }));
  }
  return <g key={n.id} data-k="node" data-id={n.id}>{k}</g>;
}

export function renderEdge(e, map, ctx, selected) {
  const { t, L } = ctx, geo = edgeGeom(e, map);
  if (!geo) return null;
  const c = selected ? t.accent : t.ink;
  const arrow = (key, p, u) => {
    const Ln = 12, W = 4.2, bx = p.x - u.x * Ln, by = p.y - u.y * Ln;
    return <polygon key={key} points={`${p.x},${p.y} ${bx - u.y * W},${by + u.x * W} ${bx + u.y * W},${by - u.x * W}`} fill={c} pointerEvents="none" />;
  };
  let label = null;
  if (e.label) {
    const fs = 13, str = txt(ctx, e.label), tw = measure(str, `${L.weight} ${fs}px ${L.family}`) + str.length * L.ls * fs + 12;
    label = [
      <rect key="lb" x={geo.mid.x - tw / 2} y={geo.mid.y - 11} width={tw} height={22} fill={t.paper} />,
      <text key="lt" x={geo.mid.x} y={geo.mid.y} textAnchor="middle" dominantBaseline="central" fill={c} fontFamily={L.family} fontWeight={L.weight} fontSize={fs} letterSpacing={L.ls * fs} pointerEvents="none">{str}</text>
    ];
  }
  return (
    <g key={e.id} data-k="edge" data-id={e.id}>
      <path d={geo.d} fill="none" stroke="transparent" strokeWidth={14} pointerEvents="stroke" />
      <path d={geo.d} fill="none" stroke={c} strokeWidth={1.5} strokeDasharray={e.dashed ? '7 5' : undefined} strokeLinejoin="miter" pointerEvents="none" />
      {(e.arrow === 'end' || e.arrow === 'both') && arrow('a2', geo.p2, geo.endDir)}
      {e.arrow === 'both' && arrow('a1', geo.p1, geo.startDir)}
      {label}
    </g>
  );
}

// Architectural dimension lines for the selected shape. Sizes stay constant on screen at any zoom.
export function renderDims(n, ctx, k) {
  const { t } = ctx, A = t.accent, sw = 1 / k, off = 22 / k, gap = 4 / k, tk = 4 / k, fs = 10.5 / k, out = [];
  const len = px => fmtLen(px, ctx.unit, ctx.g);
  const Ln = (key, x1, y1, x2, y2) => <line key={key} x1={x1} y1={y1} x2={x2} y2={y2} stroke={A} strokeWidth={sw} pointerEvents="none" />;
  const T = (key, x, y, str, rot) => (
    <text key={key} x={x} y={y} fill={A} stroke={t.paper} strokeWidth={3 / k} paintOrder="stroke" fontFamily={MONO} fontSize={fs} textAnchor="middle" transform={rot ? `rotate(-90 ${x} ${y})` : undefined} pointerEvents="none">{str}</text>
  );
  if (n.type === 'line') {
    const [a, b] = linePts(n);
    out.push(T('dl', (a.x + b.x) / 2, (a.y + b.y) / 2 - 10 / k, len(Math.hypot(b.x - a.x, b.y - a.y))));
    return out;
  }
  const yT = n.y - off, xL = n.x - off;
  out.push(
    Ln('e1', n.x, n.y - gap, n.x, yT - gap), Ln('e2', n.x + n.w, n.y - gap, n.x + n.w, yT - gap), Ln('d1', n.x, yT, n.x + n.w, yT),
    Ln('t1', n.x - tk, yT + tk, n.x + tk, yT - tk), Ln('t2', n.x + n.w - tk, yT + tk, n.x + n.w + tk, yT - tk), T('w', n.x + n.w / 2, yT - 5 / k, len(n.w))
  );
  out.push(
    Ln('e3', n.x - gap, n.y, xL - gap, n.y), Ln('e4', n.x - gap, n.y + n.h, xL - gap, n.y + n.h), Ln('d2', xL, n.y, xL, n.y + n.h),
    Ln('t3', xL - tk, n.y + tk, xL + tk, n.y - tk), Ln('t4', xL - tk, n.y + n.h + tk, xL + tk, n.y + n.h - tk), T('h', xL - 6 / k, n.y + n.h / 2, len(n.h), true)
  );
  return out;
}

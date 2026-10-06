// The Ferroprint logo: the mark (a bold F with drafting dimensions) and the wordmark.
// Both are outlines, so they look the same before the web fonts load and in exported files.
import { MARK_F, WORD, WORD_W } from './logo-paths.js';

const LINES = 'M24 13 H6 M24 44 H6 M27 48 V60 M47 48 V60';
const DIMS = 'M11 18 V39 M32 56 H42';
const HEADS = 'M11 13.5 L8.4 19.5 H13.6 Z M11 43.5 L8.4 37.5 H13.6 Z M27.5 56 L33.5 53.4 V58.6 Z M46.5 56 L40.5 53.4 V58.6 Z';
// The wordmark box: the caps run from y 0 to 68.6, and the round letters reach a little past.
const WORD_BOX = `0 -2 ${WORD_W} 73`;

// The ink takes the text color. The dimensions take the accent color of the theme.
export function Mark({ size = 28 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="logo-mark">
      <g transform="translate(5 -3)">
        <path d={MARK_F} fill="currentColor" />
        <path d={LINES} fill="none" stroke="currentColor" strokeWidth="1.2" />
        <path d={DIMS} fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        <path d={HEADS} fill="var(--accent)" />
      </g>
    </svg>
  );
}

// `size` is the font size of the wordmark in the design, so 15 gives 10.3 px tall caps.
export function Wordmark({ size = 15 }) {
  return (
    <svg width={(WORD_W * size) / 100} height={(73 * size) / 100} viewBox={WORD_BOX} role="img" aria-label="Ferroprint" className="logo-word">
      <path d={WORD} fill="currentColor" />
    </svg>
  );
}

// The logo as SVG markup for an exported drawing: the mark and the wordmark side by side, centered on (cx, cy).
export function logoSVG(cx, cy, size, ink, accent) {
  const m = size * 1.75, gap = size * 0.5, ww = (WORD_W * size) / 100, x = cx - (m + gap + ww) / 2, k = m / 64;
  const wy = cy - (0.686 * size) / 2;
  return `<g transform="translate(${x} ${cy - m / 2}) scale(${k})"><g transform="translate(5 -3)">`
    + `<path d="${MARK_F}" fill="${ink}"/><path d="${LINES}" fill="none" stroke="${ink}" stroke-width="1.2"/>`
    + `<path d="${DIMS}" fill="none" stroke="${accent}" stroke-width="1.5"/><path d="${HEADS}" fill="${accent}"/></g></g>`
    + `<path transform="translate(${x + m + gap} ${wy}) scale(${size / 100})" d="${WORD}" fill="${ink}"/>`;
}

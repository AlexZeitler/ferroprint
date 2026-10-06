// Local persistence. Every call is safe when the browser blocks or fills localStorage.
import { cleanDoc } from './engine.js';

export const DOC_KEY = 'ferroprint.doc.v1';
const UI_KEY = 'ferroprint.ui.v1';
const BACKUP_KEY = 'ferroprint.doc.unreadable';

function store() {
  try {
    const s = window.localStorage;
    const probe = 'ferroprint.probe';
    s.setItem(probe, '1');
    s.removeItem(probe);
    return s;
  } catch {
    return null;
  }
}

export const storageAvailable = () => !!store();

// Returns { doc, json } for a stored project, or null when there is nothing usable.
export function loadDoc() {
  const s = store();
  if (!s) return null;
  let raw = null;
  try { raw = s.getItem(DOC_KEY); } catch { return null; }
  if (raw == null) return null;
  return parseDoc(raw) || keepUnreadable(s, raw);
}

export function parseDoc(json) {
  try {
    const doc = cleanDoc(JSON.parse(json));
    return doc ? { doc, json: JSON.stringify(doc) } : null;
  } catch {
    return null;
  }
}

// A stored value that does not parse is copied aside, so the next autosave cannot destroy it.
function keepUnreadable(s, raw) {
  try { s.setItem(BACKUP_KEY, raw); } catch { /* storage is full */ }
  return null;
}

export function saveDoc(json) {
  const s = store();
  if (!s) return false;
  try {
    s.setItem(DOC_KEY, json);
    return true;
  } catch {
    return false;
  }
}

export function loadUI() {
  const s = store();
  try {
    const ui = s && JSON.parse(s.getItem(UI_KEY));
    return ui && typeof ui === 'object' ? ui : {};
  } catch {
    return {};
  }
}

export function saveUI(ui) {
  const s = store();
  if (!s) return;
  try { s.setItem(UI_KEY, JSON.stringify(ui)); } catch { /* not critical */ }
}

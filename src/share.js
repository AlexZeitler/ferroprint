// Share links carry the whole project in the URL fragment ("#p=…"). Browsers do not send the
// fragment to a server, so the project goes only to the people who get the link.

const KEY = 'p=';
// A shared project larger than this is refused, so a hostile link cannot fill the memory.
const MAX_BYTES = 20 * 1024 * 1024;
const canZip = typeof CompressionStream === 'function' && typeof DecompressionStream === 'function';

function toB64url(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function fromB64url(text) {
  const bin = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

async function run(bytes, stream) {
  const reader = new Blob([bytes]).stream().pipeThrough(stream).getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.length;
    if (size > MAX_BYTES) { reader.cancel(); throw new Error('The shared project is too large.'); }
    parts.push(value);
  }
  const out = new Uint8Array(size);
  let at = 0;
  parts.forEach(p => { out.set(p, at); at += p.length; });
  return out;
}

// Returns a link to this page that opens the project. Sheet views are left out, so the receiver sees each sheet fitted.
export async function shareLink(doc) {
  const json = JSON.stringify({ ...doc, sheets: doc.sheets.map(s => ({ ...s, view: null })) });
  const raw = new TextEncoder().encode(json);
  const body = canZip ? 'z' + toB64url(await run(raw, new CompressionStream('deflate-raw'))) : 'j' + toB64url(raw);
  return `${location.origin}${location.pathname}${location.search}#${KEY}${body}`;
}

export const sharedPayload = () => (location.hash.startsWith('#' + KEY) ? location.hash.slice(KEY.length + 1) : null);

// Returns the shared project as plain data, or null when the link is damaged. The caller validates it.
export async function readShared(payload) {
  try {
    const kind = payload[0], bytes = fromB64url(payload.slice(1));
    let raw = null;
    if (kind === 'z' && canZip) raw = await run(bytes, new DecompressionStream('deflate-raw'));
    else if (kind === 'j') raw = bytes;
    return raw ? JSON.parse(new TextDecoder().decode(raw)) : null;
  } catch {
    return null;
  }
}

// Removes the project from the address bar, so a reload does not open it again.
export const clearShared = () => history.replaceState(null, '', location.pathname + location.search);

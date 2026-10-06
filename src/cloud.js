// Cloud icon sets: AWS, Azure, Google Cloud and Alibaba Cloud.
// scripts/cloud-icons.mjs builds them into public/cloud/. The app loads a set the first time it needs it.

export const PROVIDERS = [
  { id: 'aws', name: 'AWS' },
  { id: 'azure', name: 'Azure' },
  { id: 'gcp', name: 'Google Cloud' },
  { id: 'alibaba', name: 'Alibaba Cloud' }
];
export const PROVIDER_NAME = Object.fromEntries(PROVIDERS.map(p => [p.id, p.name]));

const sets = {}, pending = {}, failed = {}, listeners = new Set();

// A cloud icon key is "<provider>/<icon id>", for example "aws/amazon-ec2".
export const isCloudKey = key => typeof key === 'string' && /^(aws|azure|gcp|alibaba)\/[a-z0-9-]+$/.test(key);
export const cloudProvider = key => key.split('/')[0];
export const cloudSet = id => sets[id] || null;
export const cloudFailed = id => !!failed[id];

export function cloudIcon(key) {
  if (!isCloudKey(key)) return null;
  const [p, id] = key.split('/'), s = sets[p];
  return s ? s.icons[id] || null : null;
}

// The icon name without the "(category)" or "(group)" note, for use as a label.
export const cloudLabel = icon => (icon ? icon.n.replace(/\s*\((category|group)\)$/, '') : '');

export function loadCloud(id) {
  if (sets[id]) return Promise.resolve(sets[id]);
  if (!pending[id]) {
    pending[id] = fetch(`cloud/${id}.json`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(set => { sets[id] = set; delete failed[id]; listeners.forEach(f => f(id)); return set; })
      .catch(err => { delete pending[id]; failed[id] = true; listeners.forEach(f => f(id)); throw err; });
  }
  return pending[id];
}

export function onCloudLoad(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

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

// Boundary frames: zones with the provider's group icon in the tab. Sizes follow common diagram use.
const L = [640, 420], M = [480, 300], S = [320, 200];
const frame = (id, p, name, icon, solid, size) => ({ id, p, name, icon: icon ? `${p}/${icon}` : null, solid: !!solid, w: size[0], h: size[1] });
export const FRAMES = [
  frame('aws-cloud', 'aws', 'AWS Cloud', 'aws-cloud-group', 1, L),
  frame('aws-account', 'aws', 'AWS Account', 'aws-account-group', 1, L),
  frame('aws-region', 'aws', 'Region', 'region-group', 0, L),
  frame('aws-az', 'aws', 'Availability Zone', null, 0, M),
  frame('aws-vpc', 'aws', 'VPC', 'virtual-private-cloud-vpc-group', 1, M),
  frame('aws-public-subnet', 'aws', 'Public subnet', 'public-subnet-group', 1, S),
  frame('aws-private-subnet', 'aws', 'Private subnet', 'private-subnet-group', 1, S),
  frame('aws-asg', 'aws', 'Auto Scaling group', 'auto-scaling-group-group', 0, S),
  frame('aws-security-group', 'aws', 'Security group', null, 1, S),
  frame('aws-datacenter', 'aws', 'Corporate data center', 'corporate-data-center-group', 1, M),
  frame('azure-mgmt', 'azure', 'Management group', 'management-groups', 0, L),
  frame('azure-subscription', 'azure', 'Subscription', 'subscriptions', 1, L),
  frame('azure-region', 'azure', 'Region', 'region-management', 0, L),
  frame('azure-rg', 'azure', 'Resource group', 'resource-groups', 0, M),
  frame('azure-vnet', 'azure', 'Virtual network', 'virtual-networks', 1, M),
  frame('azure-subnet', 'azure', 'Subnet', 'subnet', 0, S),
  frame('gcp-cloud', 'gcp', 'Google Cloud', null, 1, L),
  frame('gcp-project', 'gcp', 'Project', 'project', 1, L),
  frame('gcp-region', 'gcp', 'Region', null, 0, M),
  frame('gcp-zone', 'gcp', 'Zone', null, 0, S),
  frame('gcp-vpc', 'gcp', 'VPC network', 'virtual-private-cloud', 1, M),
  frame('gcp-subnet', 'gcp', 'Subnet', null, 0, S),
  frame('alibaba-cloud', 'alibaba', 'Alibaba Cloud', null, 1, L),
  frame('alibaba-region', 'alibaba', 'Region', 'region', 0, L),
  frame('alibaba-zone', 'alibaba', 'Zone', null, 0, M),
  frame('alibaba-vpc', 'alibaba', 'VPC', 'vpc-virtual-private-cloud', 1, M),
  frame('alibaba-vswitch', 'alibaba', 'vSwitch', 'vswitch', 0, S),
  frame('alibaba-security-group', 'alibaba', 'Security group', null, 1, S)
];
export const FRAME = Object.fromEntries(FRAMES.map(f => [f.id, f]));

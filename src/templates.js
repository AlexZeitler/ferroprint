// Starter templates. Each one builds a sheet, which the editor validates and adds to the project.
import { FRAME } from './cloud.js';
import { exampleDoc } from './engine.js';

const node = (id, type, x, y, w, h, label, sub, extra) => ({ id, type, x, y, w, h, label: label || '', sub: sub || '', dashed: false, fill: 'none', size: 'm', flip: false, ...extra });
const icon = (id, key, x, y, label, sub) => node(id, 'cloud', x, y, 48, 48, label, sub, { icon: key });
const frame = (id, fid, x, y, w, h, label, sub) => {
  const f = FRAME[fid];
  return node(id, 'zone', x, y, w, h, label || f.name, sub, { icon: f.icon || undefined, dashed: !f.solid, size: 's' });
};
const edge = (id, from, to, label, extra) => ({ id, from, to, label: label || '', route: 'elbow', arrow: 'end', dashed: false, ...extra });
const cls = (id, kind, x, y, w, label, attrs, ops) => node(id, 'class', x, y, w, 100, label, '', { kind, attrs, ops });
const example = n => () => { const s = exampleDoc().sheets[n]; return { name: s.name, unit: s.unit, nodes: s.nodes, edges: s.edges }; };

export const TEMPLATES = [
  {
    id: 'aws-three-tier', name: 'AWS three-tier web app', clouds: ['aws'],
    desc: 'CloudFront, a load balancer, an Auto Scaling group and a database in public and private subnets.',
    sheet: () => ({
      name: 'AWS three-tier web app', unit: 'px',
      nodes: [
        frame('cloud', 'aws-cloud', 180, 60, 1120, 700),
        frame('region', 'aws-region', 500, 100, 780, 640, 'Region', 'us-east-1'),
        frame('vpc', 'aws-vpc', 520, 160, 740, 560, 'VPC', '10.0.0.0/16'),
        frame('pub', 'aws-public-subnet', 540, 220, 180, 480),
        frame('app', 'aws-private-subnet', 740, 220, 260, 480, 'App subnet'),
        frame('asg', 'aws-asg', 760, 280, 220, 360),
        frame('data', 'aws-private-subnet', 1020, 220, 220, 480, 'Data subnet'),
        icon('users', 'aws/users', 60, 340, 'Users'),
        icon('dns', 'aws/amazon-route-53', 240, 340, 'Route 53'),
        icon('cdn', 'aws/amazon-cloudfront', 380, 340, 'CloudFront'),
        icon('s3', 'aws/amazon-simple-storage-service', 380, 560, 'S3', 'static assets'),
        icon('alb', 'aws/elastic-load-balancing-application-load-balancer', 606, 380, 'Load balancer'),
        icon('nat', 'aws/amazon-vpc-nat-gateway', 606, 560, 'NAT gateway'),
        icon('ec2a', 'aws/amazon-ec2-instance', 846, 340, 'App server'),
        icon('ec2b', 'aws/amazon-ec2-instance', 846, 500, 'App server'),
        icon('db1', 'aws/amazon-rds', 1106, 340, 'Primary DB'),
        icon('db2', 'aws/amazon-rds', 1106, 500, 'Standby DB')
      ],
      edges: [
        edge('e1', 'users', 'dns', 'DNS'), edge('e2', 'dns', 'cdn'), edge('e3', 'cdn', 'alb', 'HTTPS'),
        edge('e4', 'cdn', 's3', 'static', { dashed: true }), edge('e5', 'alb', 'ec2a'), edge('e6', 'alb', 'ec2b'),
        edge('e7', 'ec2a', 'db1'), edge('e8', 'ec2b', 'db1'), edge('e9', 'db1', 'db2', 'replica', { dashed: true })
      ]
    })
  },
  {
    id: 'azure-hub-spoke', name: 'Azure hub-and-spoke network', clouds: ['azure'],
    desc: 'A hub virtual network with VPN gateway, firewall and Bastion, and two peered spokes.',
    sheet: () => ({
      name: 'Azure hub-and-spoke', unit: 'px',
      nodes: [
        frame('sub', 'azure-subscription', 200, 60, 1000, 660, 'Subscription', 'Production'),
        frame('hub', 'azure-vnet', 240, 120, 300, 560, 'Hub VNet', '10.0.0.0/16'),
        frame('web', 'azure-vnet', 640, 120, 520, 260, 'Spoke: web', '10.1.0.0/16'),
        frame('aks', 'azure-vnet', 640, 420, 520, 260, 'Spoke: AKS', '10.2.0.0/16'),
        icon('onprem', 'azure/local-network-gateways', 60, 200, 'On-premises'),
        icon('vpn', 'azure/virtual-network-gateways', 366, 200, 'VPN gateway'),
        icon('fw', 'azure/firewalls', 366, 360, 'Azure Firewall'),
        icon('bastion', 'azure/bastions', 366, 520, 'Bastion'),
        icon('app', 'azure/app-services', 740, 220, 'Web app'),
        icon('sql', 'azure/sql-database', 980, 220, 'SQL Database'),
        icon('k8s', 'azure/kubernetes-services', 740, 520, 'AKS cluster'),
        icon('kv', 'azure/key-vaults', 980, 520, 'Key Vault')
      ],
      edges: [
        edge('e1', 'onprem', 'vpn', 'site-to-site VPN'), edge('e2', 'vpn', 'fw'), edge('e3', 'fw', 'app', 'peering'),
        edge('e4', 'fw', 'k8s', 'peering'), edge('e5', 'app', 'sql'), edge('e6', 'k8s', 'kv', 'secrets', { dashed: true })
      ]
    })
  },
  {
    id: 'gcp-data-pipeline', name: 'Google Cloud data pipeline', clouds: ['gcp'],
    desc: 'Pub/Sub and Cloud Storage into Dataflow, a BigQuery warehouse, Looker and Vertex AI.',
    sheet: () => ({
      name: 'Google Cloud data pipeline', unit: 'px',
      nodes: [
        frame('cloud', 'gcp-cloud', 40, 40, 1180, 600),
        frame('project', 'gcp-project', 80, 100, 1100, 500, 'Project', 'analytics-prod'),
        icon('pubsub', 'gcp/pub-sub', 160, 200, 'Pub/Sub', 'click events'),
        icon('gcs', 'gcp/cloud-storage', 160, 420, 'Cloud Storage', 'daily exports'),
        icon('flow', 'gcp/dataflow', 420, 300, 'Dataflow', 'stream and batch'),
        icon('bq', 'gcp/bigquery', 680, 300, 'BigQuery', 'warehouse'),
        icon('looker', 'gcp/looker', 940, 200, 'Looker'),
        icon('vertex', 'gcp/vertex-ai', 940, 420, 'Vertex AI'),
        icon('composer', 'gcp/cloud-composer', 420, 470, 'Cloud Composer')
      ],
      edges: [
        edge('e1', 'pubsub', 'flow', 'stream'), edge('e2', 'gcs', 'flow', 'batch'), edge('e3', 'flow', 'bq'),
        edge('e4', 'bq', 'looker', 'dashboards'), edge('e5', 'bq', 'vertex', 'features'), edge('e6', 'composer', 'flow', 'schedules', { dashed: true })
      ]
    })
  },
  {
    id: 'alibaba-web-app', name: 'Alibaba Cloud web app', clouds: ['alibaba'],
    desc: 'CDN and OSS in front of a load balancer, two ECS servers, PolarDB and Redis in a VPC.',
    sheet: () => ({
      name: 'Alibaba Cloud web app', unit: 'px',
      nodes: [
        frame('cloud', 'alibaba-cloud', 180, 60, 1080, 600),
        frame('region', 'alibaba-region', 380, 100, 840, 520, 'Region', 'cn-hangzhou'),
        frame('vpc', 'alibaba-vpc', 400, 160, 800, 440, 'VPC', '172.16.0.0/12'),
        frame('vsw', 'alibaba-vswitch', 580, 220, 600, 360, 'vSwitch', 'Zone H'),
        icon('users', 'alibaba/user', 60, 300, 'Users'),
        icon('cdn', 'alibaba/cdn-content-distribution-network', 240, 300, 'CDN'),
        icon('oss', 'alibaba/oss-object-storage-service', 240, 480, 'OSS', 'static assets'),
        icon('slb', 'alibaba/slb-server-load-balancer', 460, 340, 'SLB'),
        icon('ecsa', 'alibaba/ecs-elastic-compute-service', 680, 280, 'Web server'),
        icon('ecsb', 'alibaba/ecs-elastic-compute-service', 680, 460, 'Web server'),
        icon('db', 'alibaba/polardb', 960, 280, 'PolarDB'),
        icon('cache', 'alibaba/redis-kvstore', 960, 460, 'Redis')
      ],
      edges: [
        edge('e1', 'users', 'cdn'), edge('e2', 'cdn', 'slb'), edge('e3', 'cdn', 'oss', 'static', { dashed: true }),
        edge('e4', 'slb', 'ecsa'), edge('e5', 'slb', 'ecsb'), edge('e6', 'ecsa', 'db'), edge('e7', 'ecsb', 'db'),
        edge('e8', 'ecsa', 'cache', '', { dashed: true }), edge('e9', 'ecsb', 'cache', '', { dashed: true })
      ]
    })
  },
  {
    id: 'class-diagram', name: 'Class diagram', clouds: [],
    desc: 'An online shop domain with classes, an interface, an enum, an abstract class and each UML relation.',
    sheet: () => ({
      name: 'Shop domain classes', unit: 'px',
      nodes: [
        node('pkg', 'zone', 0, 0, 1040, 900, 'shop.domain', '', { pkg: true, size: 's' }),
        cls('customer', 'class', 40, 60, 240, 'Customer', '- id: UUID\n- name: String\n- email: Email', '+ placeOrder(cart: Cart): Order'),
        cls('order', 'class', 380, 60, 240, 'Order', '- id: UUID\n- placedAt: Instant\n- status: OrderStatus', '+ total(): Money\n+ cancel(): void'),
        cls('status', 'enum', 740, 60, 200, 'OrderStatus', 'PENDING\nPAID\nSHIPPED\nCANCELLED', ''),
        cls('pay', 'interface', 40, 330, 260, 'PaymentMethod', '', '+ authorize(amount: Money): Receipt'),
        cls('line', 'class', 380, 330, 240, 'OrderLine', '- quantity: Int\n- price: Money', '+ subtotal(): Money'),
        cls('product', 'class', 740, 330, 200, 'Product', '- sku: String\n- name: String\n- price: Money', ''),
        cls('card', 'class', 20, 560, 280, 'Card', '- last4: String', '+ authorize(amount: Money): Receipt'),
        cls('wallet', 'class', 330, 560, 280, 'Wallet', '- provider: String', '+ authorize(amount: Money): Receipt'),
        cls('discount', 'abstract', 740, 560, 240, 'Discount', '- code: String', '+ apply(order: Order): Money'),
        cls('percent', 'class', 740, 760, 240, 'PercentOff', '- percent: Int', '+ apply(order: Order): Money')
      ],
      edges: [
        edge('r1', 'customer', 'order', 'places', { rel: 'assoc', m1: '1', m2: '0..*' }),
        edge('r2', 'order', 'line', '', { rel: 'compose', m1: '1', m2: '1..*' }),
        edge('r3', 'line', 'product', '', { rel: 'assoc', m1: '0..*', m2: '1' }),
        edge('r4', 'order', 'status', '', { rel: 'depend' }),
        edge('r5', 'order', 'pay', 'paid with', { rel: 'assoc', m2: '1' }),
        edge('r6', 'card', 'pay', '', { rel: 'realize' }),
        edge('r7', 'wallet', 'pay', '', { rel: 'realize' }),
        edge('r8', 'order', 'discount', '', { rel: 'aggregate', m2: '0..*', fromSide: 'right', toSide: 'top', pts: [{ x: 680, y: 129 }, { x: 680, y: 520 }] }),
        edge('r9', 'percent', 'discount', '', { rel: 'inherit' })
      ]
    })
  },
  { id: 'floor-plan', name: 'Apartment floor plan', clouds: [], desc: 'Five rooms with doors, windows and furniture, drawn in feet.', sheet: example(2) },
  { id: 'checkout', name: 'Checkout flow', clouds: [], desc: 'Two screens and the decision between them: an interface wireframe with a flow.', sheet: example(1) },
  { id: 'services', name: 'Microservices overview', clouds: [], desc: 'Users, a gateway, services, databases and an event bus inside a network zone.', sheet: example(0) }
];

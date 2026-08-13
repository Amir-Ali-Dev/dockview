import http from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = Number(process.env.PORT || 3000);
const SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';
const API_TOKEN = process.env.API_TOKEN || '';
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const API_VERSION = 'v1.41';

const mime = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml' };

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify(body));
}

function docker(method, endpoint) {
  return new Promise((resolve, reject) => {
    const req = http.request({ socketPath: SOCKET, path: `/${API_VERSION}${endpoint}`, method }, (response) => {
      let raw = '';
      response.setEncoding('utf8');
      response.on('data', chunk => raw += chunk);
      response.on('end', () => {
        let data = raw;
        try { data = raw ? JSON.parse(raw) : {}; } catch {}
        if (response.statusCode >= 400) return reject(Object.assign(new Error(data.message || `Docker API ${response.statusCode}`), { status: response.statusCode }));
        resolve(data);
      });
    });
    req.on('error', reject);
    req.end();
  });
}

function cpuPercent(s) {
  const cpuDelta = (s.cpu_stats?.cpu_usage?.total_usage || 0) - (s.precpu_stats?.cpu_usage?.total_usage || 0);
  const systemDelta = (s.cpu_stats?.system_cpu_usage || 0) - (s.precpu_stats?.system_cpu_usage || 0);
  const cpus = s.cpu_stats?.online_cpus || s.cpu_stats?.cpu_usage?.percpu_usage?.length || 1;
  return systemDelta > 0 && cpuDelta > 0 ? cpuDelta / systemDelta * cpus * 100 : 0;
}

async function containerStats(container) {
  if (container.State !== 'running') return { id: container.Id, cpu: 0, memory: 0, memoryLimit: 0, memoryPercent: 0, netRx: 0, netTx: 0 };
  try {
    const s = await docker('GET', `/containers/${container.Id}/stats?stream=false`);
    const cache = s.memory_stats?.stats?.inactive_file || 0;
    const memory = Math.max(0, (s.memory_stats?.usage || 0) - cache);
    const memoryLimit = s.memory_stats?.limit || 0;
    const networks = Object.values(s.networks || {});
    return {
      id: container.Id,
      cpu: cpuPercent(s), memory, memoryLimit,
      memoryPercent: memoryLimit ? memory / memoryLimit * 100 : 0,
      netRx: networks.reduce((n, x) => n + (x.rx_bytes || 0), 0),
      netTx: networks.reduce((n, x) => n + (x.tx_bytes || 0), 0)
    };
  } catch { return { id: container.Id, cpu: 0, memory: 0, memoryLimit: 0, memoryPercent: 0, netRx: 0, netTx: 0 }; }
}

async function api(req, res, url) {
  if (API_TOKEN && req.headers['x-api-key'] !== API_TOKEN) return json(res, 401, { message: 'API key is missing or invalid' });

  if (req.method === 'GET' && url.pathname === '/api/overview') {
    const [info, containers, images, volumes, networks] = await Promise.all([
      docker('GET', '/info'), docker('GET', '/containers/json?all=true'), docker('GET', '/images/json'), docker('GET', '/volumes'), docker('GET', '/networks')
    ]);
    const stats = await Promise.all(containers.map(containerStats));
    return json(res, 200, {
      engine: { name: info.Name, version: info.ServerVersion, os: info.OperatingSystem, kernel: info.KernelVersion, cpus: info.NCPU, memory: info.MemTotal },
      counts: { containers: containers.length, running: containers.filter(c => c.State === 'running').length, images: images.length, volumes: volumes.Volumes?.length || 0, networks: networks.length },
      containers: containers.map(c => ({ id: c.Id, name: (c.Names?.[0] || '').replace(/^\//, ''), image: c.Image, state: c.State, status: c.Status, created: c.Created, ports: c.Ports || [], stats: stats.find(s => s.id === c.Id) }))
    });
  }

  const detail = url.pathname.match(/^\/api\/containers\/([a-f0-9]+)$/);
  if (req.method === 'GET' && detail) {
    const c = await docker('GET', `/containers/${detail[1]}/json`);
    return json(res, 200, c);
  }

  const action = url.pathname.match(/^\/api\/containers\/([a-f0-9]+)\/(start|stop|restart)$/);
  if (req.method === 'POST' && action) {
    await docker('POST', `/containers/${action[1]}/${action[2]}?t=10`);
    return json(res, 200, { ok: true });
  }
  return json(res, 404, { message: 'Not found' });
}

async function staticFile(res, pathname) {
  const requested = pathname === '/' ? 'index.html' : pathname.slice(1);
  const file = path.resolve(ROOT, requested);
  if (!file.startsWith(ROOT)) return json(res, 403, { message: 'Forbidden' });
  try {
    const meta = await stat(file);
    if (!meta.isFile()) throw new Error();
    const body = await readFile(file);
    res.writeHead(200, { 'content-type': mime[path.extname(file)] || 'application/octet-stream', 'cache-control': 'no-cache' });
    res.end(body);
  } catch { json(res, 404, { message: 'Not found' }); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  try {
    if (url.pathname.startsWith('/api/')) await api(req, res, url);
    else await staticFile(res, url.pathname);
  } catch (error) {
    console.error(error);
    json(res, error.status || 503, { message: error.message || 'Docker is unavailable' });
  }
});

server.listen(PORT, '0.0.0.0', () => console.log(`Dockview listening on :${PORT}`));

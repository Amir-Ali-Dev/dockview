const $ = selector => document.querySelector(selector);
const state = { data: null, busy: false, authResolve: null };

const icons = {
  container: '<svg viewBox="0 0 24 24"><path d="m12 2.8 8 4.6v9.2l-8 4.6-8-4.6V7.4l8-4.6Z"/><path d="m4.5 7.7 7.5 4.2 7.5-4.2M12 12v8.5"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="m8 5 11 7-11 7V5Z"/></svg>',
  stop: '<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" rx="2"/></svg>',
  restart: '<svg viewBox="0 0 24 24"><path d="M20 6v5h-5"/><path d="M18.5 9A7 7 0 1 0 19 15"/></svg>',
  inspect: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4M11 8v6M8 11h6"/></svg>'
};

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
})[character]);

function formatBytes(value = 0) {
  if (!value) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(value) / Math.log(1024)), units.length - 1);
  return `${(value / 1024 ** index).toFixed(index > 1 ? 1 : 0)} ${units[index]}`;
}

function formatUptime(created) {
  const seconds = Math.max(0, Date.now() / 1000 - created);
  if (seconds < 60) return `${Math.floor(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h`;
  return `${Math.floor(seconds / 86400)}d`;
}

function accessHeaders() {
  const key = localStorage.getItem('dockview-key');
  return key ? { 'x-api-key': key } : {};
}

function askForAccess(message = '') {
  $('#auth-error').textContent = message;
  $('#api-key').value = '';
  if (!$('#auth-dialog').open) $('#auth-dialog').showModal();
  setTimeout(() => $('#api-key').focus(), 50);
  return new Promise(resolve => { state.authResolve = resolve; });
}

$('#auth-form').addEventListener('submit', event => {
  event.preventDefault();
  const key = $('#api-key').value.trim();
  if (!key) return;
  localStorage.setItem('dockview-key', key);
  $('#auth-dialog').close();
  state.authResolve?.();
  state.authResolve = null;
});

async function request(url, options = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await fetch(url, { ...options, headers: { ...accessHeaders(), ...options.headers } });
    if (response.status === 401) {
      localStorage.removeItem('dockview-key');
      await askForAccess(attempt ? 'That key was not accepted. Please try again.' : '');
      continue;
    }
    const body = await response.json();
    if (!response.ok) throw new Error(body.message || 'Could not reach the Docker host.');
    return body;
  }
  throw new Error('Authentication failed. Reload the page to try again.');
}

function setGreeting() {
  const hour = new Date().getHours();
  $('#greeting').textContent = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';
}

function metricCard(label, value, caption, tone, icon) {
  return `<article class="metric-card panel ${tone}"><div class="metric-top"><span>${label}</span><i>${icon}</i></div><strong>${value}</strong><p>${caption}</p><span class="metric-glow"></span></article>`;
}

function render(data) {
  state.data = data;
  const { engine, counts } = data;
  const stopped = counts.containers - counts.running;
  const runningRate = counts.containers ? Math.round(counts.running / counts.containers * 100) : 100;
  $('#engine').innerHTML = `<div class="host-primary"><span class="host-icon"><svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="6" rx="2"/><rect x="3" y="14" width="18" height="6" rx="2"/><path d="M7 7h.01M7 17h.01M11 7h6M11 17h6"/></svg></span><div><span class="label"><i></i> Docker host online</span><h2>${escapeHtml(engine.name)}</h2><p>${escapeHtml(engine.os)} · Kernel ${escapeHtml(engine.kernel)}</p></div></div><div class="host-facts"><div><span>Engine</span><strong>v${escapeHtml(engine.version)}</strong></div><div><span>Processors</span><strong>${engine.cpus} cores</strong></div><div><span>Host memory</span><strong>${formatBytes(engine.memory)}</strong></div><div class="availability"><span>Workload online</span><strong>${runningRate}%</strong><div><i style="width:${runningRate}%"></i></div></div></div>`;
  $('#metrics').innerHTML = [
    metricCard('Total containers', counts.containers, 'Across every runtime state', 'blue', icons.container),
    metricCard('Running now', counts.running, `${runningRate}% of workloads online`, 'green', icons.play),
    metricCard('Stopped', stopped, stopped ? 'May require your attention' : 'Everything looks healthy', stopped ? 'orange' : 'neutral', icons.stop),
    metricCard('Local images', counts.images, `${counts.volumes} volumes · ${counts.networks} networks`, 'purple', '<svg viewBox="0 0 24 24"><path d="M5 7.5 12 4l7 3.5-7 3.5-7-3.5Z"/><path d="m5 12 7 3.5 7-3.5M5 16.5 12 20l7-3.5"/></svg>')
  ].join('');
  $('#nav-running').textContent = counts.running;
  $('#connection').textContent = `Connected · v${engine.version}`;
  $('.status-dot').classList.add('online');
  $('#updated').textContent = `Updated ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  $('#error').classList.add('hidden');
  renderRows();
}

function renderRows() {
  if (!state.data) return;
  const query = $('#search').value.trim().toLowerCase();
  const filter = $('#state').value;
  const containers = state.data.containers.filter(container => (filter === 'all' || container.state === filter) && (container.name.toLowerCase().includes(query) || container.image.toLowerCase().includes(query)));
  if (!containers.length) {
    $('#rows').innerHTML = '<tr><td colspan="7" class="empty-state"><span class="empty-icon">⌕</span>No containers match this view.</td></tr>';
    return;
  }
  $('#rows').innerHTML = containers.map(container => {
    const stats = container.stats || {};
    const running = container.state === 'running';
    const ports = container.ports.slice(0, 2).map(port => port.PublicPort ? `${port.PublicPort} → ${port.PrivatePort}` : `${port.PrivatePort}/tcp`).join('<br>') || '<span class="muted">Not published</span>';
    const memoryValue = stats.memoryLimit ? `${formatBytes(stats.memory)} / ${formatBytes(stats.memoryLimit)}` : formatBytes(stats.memory);
    return `<tr><td><button class="container-name" onclick="showDetails('${container.id}')"><span class="container-icon">${icons.container}</span><span><strong>${escapeHtml(container.name || container.id.slice(0, 12))}</strong><small>${escapeHtml(container.image)}</small></span></button></td><td><span class="state-pill ${escapeHtml(container.state)}"><i></i>${running ? 'Running' : escapeHtml(container.state)}</span><small class="uptime">${running ? `Up ${formatUptime(container.created)}` : escapeHtml(container.status)}</small></td><td><span class="metric-value">${stats.cpu.toFixed(1)}%</span><div class="progress"><i style="width:${Math.min(stats.cpu, 100)}%"></i></div></td><td><span class="metric-value">${memoryValue}</span><div class="progress memory"><i style="width:${Math.min(stats.memoryPercent, 100)}%"></i></div></td><td><span class="io"><i>↓</i> ${formatBytes(stats.netRx)} <i>↑</i> ${formatBytes(stats.netTx)}</span></td><td><span class="ports">${ports}</span></td><td><div class="row-actions"><button title="Inspect container" onclick="showDetails('${container.id}')">${icons.inspect}</button><button title="${running ? 'Stop' : 'Start'} container" onclick="runAction('${container.id}','${running ? 'stop' : 'start'}','${escapeHtml(container.name)}')">${running ? icons.stop : icons.play}</button><button title="Restart container" onclick="runAction('${container.id}','restart','${escapeHtml(container.name)}')">${icons.restart}</button></div></td></tr>`;
  }).join('');
}

function showToast(message, type = 'success') {
  const toast = $('#toast');
  toast.textContent = message;
  toast.className = `toast visible ${type}`;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove('visible'), 3200);
}

async function load(showSpinner = false) {
  if (state.busy) return;
  state.busy = true;
  if (showSpinner) $('#refresh').classList.add('spinning');
  try { render(await request('/api/overview')); }
  catch (error) { $('#error').textContent = error.message; $('#error').classList.remove('hidden'); $('#connection').textContent = 'Connection unavailable'; $('.status-dot').classList.remove('online'); }
  finally { state.busy = false; $('#refresh').classList.remove('spinning'); }
}

window.runAction = async (id, action, name) => {
  if (!confirm(`${action[0].toUpperCase() + action.slice(1)} “${name}”?`)) return;
  try { await request(`/api/containers/${id}/${action}`, { method: 'POST' }); showToast(`${name} ${action === 'stop' ? 'stopped' : action === 'start' ? 'started' : 'restarted'} successfully.`); setTimeout(() => load(true), 650); }
  catch (error) { showToast(error.message, 'error'); }
};

window.showDetails = async id => {
  try {
    const container = await request(`/api/containers/${id}`);
    const labels = Object.entries(container.Config.Labels || {}).slice(0, 8).map(([key, value]) => `<span>${escapeHtml(key)}</span>${escapeHtml(value)}`).join('') || '<span>Labels</span>None';
    const mounts = container.Mounts?.map(mount => escapeHtml(mount.Destination)).join('<br>') || 'None';
    const running = container.State.Status === 'running';
    $('#detail-body').innerHTML = `<div class="detail-heading"><span class="container-icon large">${icons.container}</span><div><span class="state-pill ${escapeHtml(container.State.Status)}"><i></i>${escapeHtml(container.State.Status)}</span><h2>${escapeHtml(container.Name.replace(/^\//, ''))}</h2><p>${escapeHtml(container.Config.Image)}</p></div></div><div class="detail-grid"><div class="wide"><span>Container ID</span><code>${escapeHtml(container.Id)}</code></div><div><span>Started</span><strong>${running ? new Date(container.State.StartedAt).toLocaleString() : 'Not running'}</strong></div><div><span>Restart policy</span><strong>${escapeHtml(container.HostConfig.RestartPolicy?.Name || 'no')}</strong></div><div><span>IP address</span><strong>${escapeHtml(container.NetworkSettings.IPAddress || 'Not assigned')}</strong></div><div><span>Process ID</span><strong>${container.State.Pid || '—'}</strong></div><div class="wide"><span>Mounted paths</span><code>${mounts}</code></div><div class="wide labels"><span>Labels</span><code>${labels}</code></div></div>`;
    $('#detail').showModal();
  } catch (error) { showToast(error.message, 'error'); }
};

$('.close-button').addEventListener('click', () => $('#detail').close());
$('#refresh').addEventListener('click', () => load(true));
$('#search').addEventListener('input', renderRows);
$('#state').addEventListener('change', renderRows);
document.querySelector('[data-scroll="containers"]').addEventListener('click', () => $('#containers').scrollIntoView({ behavior: 'smooth' }));
setGreeting();
load();
setInterval(load, 5000);

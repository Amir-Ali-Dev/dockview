const $ = s => document.querySelector(s);
const state = { data: null, busy: false };
const formatBytes = (n = 0) => { if (!n) return '0 B'; const u=['B','KB','MB','GB','TB'],i=Math.min(Math.floor(Math.log(n)/Math.log(1024)),4); return `${(n/1024**i).toFixed(i>1?1:0)} ${u[i]}` };
const esc = value => String(value ?? '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const headers = () => { const key=localStorage.getItem('dockview-key'); return key ? {'x-api-key':key} : {} };

async function request(url, options={}) {
  const response = await fetch(url, {...options, headers:{...headers(), ...options.headers}});
  if (response.status === 401) {
    const key = prompt('کلید دسترسی Dockview را وارد کنید:');
    if (key) { localStorage.setItem('dockview-key', key); return request(url, options); }
  }
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'خطا در ارتباط با سرور');
  return body;
}

function render(data) {
  state.data=data; const e=data.engine, c=data.counts;
  $('#engine').classList.remove('skeleton');
  $('#engine').innerHTML=`<div><span class="server-icon">⌁</span><div><small>میزبان داکر</small><h2>${esc(e.name)}</h2></div><div class="engine-meta"><span>نسخه Docker<b>${esc(e.version)}</b></span><span>سیستم‌عامل<b>${esc(e.os)}</b></span><span>CPU<b>${e.cpus} هسته</b></span><span>RAM<b>${formatBytes(e.memory)}</b></span></div></div>`;
  $('#metrics').innerHTML=[['کل کانتینرها',c.containers,'تمام وضعیت‌ها',''],['در حال اجرا',c.running,'کانتینر فعال','running'],['متوقف',c.containers-c.running,'نیازمند بررسی',''],['ایمیج‌ها',c.images,'روی میزبان',''],['والیوم‌ها',c.volumes,`${c.networks} شبکه`,'']].map(x=>`<article class="metric card ${x[3]}"><small>${x[0]}</small><strong>${x[1]}</strong><p>${x[2]}</p></article>`).join('');
  renderRows();
  $('#connection').textContent='متصل · '+e.version; $('.connection i').style.background='var(--green)';
  $('#updated').textContent='بروزرسانی: '+new Date().toLocaleTimeString('fa-IR');
  $('#error').classList.add('hidden');
}

function renderRows() {
  if(!state.data)return; const q=$('#search').value.toLowerCase(), filter=$('#state').value;
  const list=state.data.containers.filter(c=>(filter==='all'||c.state===filter)&&(c.name.toLowerCase().includes(q)||c.image.toLowerCase().includes(q)));
  $('#rows').innerHTML=list.length?list.map(c=>{const s=c.stats||{},running=c.state==='running',ports=c.ports.slice(0,2).map(p=>p.PublicPort?`${p.PublicPort}:${p.PrivatePort}`:`${p.PrivatePort}`).join(', ')||'—';return `<tr><td><div class="name"><span class="cube">⬡</span><div><b>${esc(c.name||c.id.slice(0,12))}</b><small>${esc(c.image)}</small></div></div></td><td><span class="badge ${esc(c.state)}">${running?'● فعال':'○ '+esc(c.state)}</span></td><td><span class="value">${s.cpu.toFixed(1)}%</span><div class="bar"><i style="width:${Math.min(s.cpu,100)}%"></i></div></td><td><span class="value">${formatBytes(s.memory)} / ${formatBytes(s.memoryLimit)}</span><div class="bar"><i style="width:${Math.min(s.memoryPercent,100)}%"></i></div></td><td class="value">↓ ${formatBytes(s.netRx)}<br>↑ ${formatBytes(s.netTx)}</td><td class="value">${esc(ports)}</td><td><div class="actions"><button title="جزئیات" onclick="details('${c.id}')">⌕</button><button title="${running?'توقف':'اجرا'}" onclick="action('${c.id}','${running?'stop':'start'}')">${running?'■':'▶'}</button><button title="راه‌اندازی مجدد" onclick="action('${c.id}','restart')">↻</button></div></td></tr>`}).join(''):'<tr><td colspan="7" class="empty">کانتینری پیدا نشد.</td></tr>';
}

async function load(showSpinner=false) {
  if(state.busy)return; state.busy=true; if(showSpinner)$('#refresh').textContent='…';
  try { render(await request('/api/overview')); }
  catch(e){ $('#error').textContent=e.message; $('#error').classList.remove('hidden'); $('#connection').textContent='قطع ارتباط'; $('.connection i').style.background='var(--red)'; }
  finally { state.busy=false; $('#refresh').textContent='↻'; }
}

window.action=async(id,action)=>{if(!confirm(`عملیات ${action} روی این کانتینر انجام شود؟`))return;try{await request(`/api/containers/${id}/${action}`,{method:'POST'});setTimeout(()=>load(true),700)}catch(e){alert(e.message)}};
window.details=async id=>{try{const c=await request(`/api/containers/${id}`),labels=Object.entries(c.Config.Labels||{}).slice(0,8).map(([k,v])=>`${esc(k)}=${esc(v)}`).join('<br>')||'—';$('#detail-body').innerHTML=`<h2>${esc(c.Name.replace(/^\//,''))}</h2><p style="color:var(--muted)">${esc(c.Config.Image)}</p><div class="detail-grid"><div><small>Container ID</small><code>${esc(c.Id)}</code></div><div><small>وضعیت</small><code>${esc(c.State.Status)} · ${esc(c.State.StartedAt)}</code></div><div><small>Restart Policy</small><code>${esc(c.HostConfig.RestartPolicy?.Name||'no')}</code></div><div><small>IP Address</small><code>${esc(c.NetworkSettings.IPAddress||'—')}</code></div><div><small>Mounts</small><code>${c.Mounts?.map(m=>esc(m.Destination)).join('<br>')||'—'}</code></div><div><small>Labels</small><code>${labels}</code></div></div>`;$('#detail').showModal()}catch(e){alert(e.message)}};
$('#detail .close').onclick=()=>$('#detail').close(); $('#refresh').onclick=()=>load(true); $('#search').oninput=renderRows; $('#state').onchange=renderRows;
load(); setInterval(load,5000);

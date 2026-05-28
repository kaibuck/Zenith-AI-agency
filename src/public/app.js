/* ─── State ───────────────────────────────────────────────────────────────────── */
let currentLeadId = null;
let settingsCache = null;

/* ─── Init ────────────────────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  checkAuth();
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', e => { e.preventDefault(); switchSection(el.dataset.section); });
  });
});

/* ─── Auth ────────────────────────────────────────────────────────────────────── */
async function checkAuth() {
  try {
    const res = await fetch('/api/admin/me');
    if (res.ok) { showApp(); }
    else         { showLogin(); }
  } catch { showLogin(); }
}

async function handleLogin(e) {
  e.preventDefault();
  const password = document.getElementById('password-input').value;
  const err = document.getElementById('login-error');
  err.classList.add('hidden');

  const res = await fetch('/api/admin/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password }),
  });

  if (res.ok) { showApp(); }
  else        { err.classList.remove('hidden'); }
}

async function handleLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  showLogin();
}

function showLogin() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
}

function showApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  switchSection('dashboard');
}

/* ─── Navigation ──────────────────────────────────────────────────────────────── */
function switchSection(name) {
  document.querySelectorAll('.section').forEach(s => s.classList.add('hidden'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  const section = document.getElementById(`section-${name}`);
  const navItem = document.querySelector(`.nav-item[data-section="${name}"]`);
  if (section) section.classList.remove('hidden');
  if (navItem) navItem.classList.add('active');

  if (name === 'dashboard')     loadStats();
  if (name === 'leads')         loadLeads();
  if (name === 'settings')      loadSettings();
  if (name === 'sms-templates') loadTemplates();
}

/* ─── Dashboard ───────────────────────────────────────────────────────────────── */
async function loadStats() {
  try {
    const [statsRes, activityRes] = await Promise.all([
      fetch('/api/admin/stats'),
      fetch('/api/admin/activity'),
    ]);
    const stats    = await statsRes.json();
    const activity = await activityRes.json();

    document.getElementById('stat-total').textContent   = stats.total ?? '—';
    document.getElementById('stat-today').textContent   = stats.todayBooked ?? '—';
    document.getElementById('stat-pending').textContent = stats.pending ?? '—';
    document.getElementById('stat-rate').textContent    = stats.conversionRate != null ? `${stats.conversionRate}%` : '—';
    document.getElementById('last-updated').textContent = `Updated ${new Date().toLocaleTimeString()}`;

    const body = document.getElementById('activity-body');
    if (!activity.length) {
      body.innerHTML = '<tr><td colspan="6" class="empty-state">No activity yet</td></tr>';
      return;
    }
    body.innerHTML = activity.map(l => `
      <tr style="cursor:pointer" onclick="openLead(${l.id})">
        <td>${l.name || '<em style="color:#9ca3af">Unknown</em>'}</td>
        <td>${l.phone}</td>
        <td>${l.service || '—'}</td>
        <td><span class="badge badge-${l.channel}">${l.channel}</span></td>
        <td><span class="badge badge-${l.status}">${l.status}</span></td>
        <td>${formatDate(l.created_at)}</td>
      </tr>`).join('');
  } catch (err) {
    console.error('loadStats error', err);
  }
}

/* ─── Leads ───────────────────────────────────────────────────────────────────── */
async function loadLeads() {
  const status = document.getElementById('leads-status-filter')?.value || '';
  const url = '/api/admin/leads' + (status ? `?status=${status}` : '');
  try {
    const res   = await fetch(url);
    const leads = await res.json();
    const body  = document.getElementById('leads-body');

    if (!leads.length) {
      body.innerHTML = '<tr><td colspan="8" class="empty-state">No leads found</td></tr>';
      return;
    }

    body.innerHTML = leads.map(l => `
      <tr style="cursor:pointer" onclick="openLead(${l.id})">
        <td>${l.name || '<em style="color:#9ca3af">—</em>'}</td>
        <td>${l.phone}</td>
        <td>${l.service || '—'}</td>
        <td>${l.preferred_time || '—'}</td>
        <td><span class="badge badge-${l.channel}">${l.channel}</span></td>
        <td><span class="badge badge-${l.status}">${l.status}</span></td>
        <td>${formatDate(l.created_at)}</td>
        <td><button class="btn btn-sm btn-outline" onclick="event.stopPropagation();openLead(${l.id})">View</button></td>
      </tr>`).join('');
  } catch (err) {
    console.error('loadLeads error', err);
  }
}

/* ─── Lead Modal ──────────────────────────────────────────────────────────────── */
async function openLead(id) {
  currentLeadId = id;
  const res  = await fetch(`/api/admin/leads/${id}`);
  const lead = await res.json();

  document.getElementById('modal-title').textContent   = lead.name || `Lead #${id}`;
  document.getElementById('modal-status').value        = lead.status || 'new';
  document.getElementById('modal-notes').value         = lead.notes || '';

  document.getElementById('modal-meta').innerHTML = `
    <div class="meta-item"><label>Phone</label><p>${lead.phone}</p></div>
    <div class="meta-item"><label>Channel</label><p>${lead.channel}</p></div>
    <div class="meta-item"><label>Service</label><p>${lead.service || '—'}</p></div>
    <div class="meta-item"><label>Preferred Time</label><p>${lead.preferred_time || '—'}</p></div>
    <div class="meta-item"><label>Appointment ID</label><p style="word-break:break-all;font-size:11px">${lead.appointment_id || '—'}</p></div>
    <div class="meta-item"><label>Created</label><p>${formatDate(lead.created_at)}</p></div>
  `;

  const log = lead.conversation_log || [];
  const convoEl = document.getElementById('modal-convo');
  if (!log.length) {
    convoEl.innerHTML = '<p style="text-align:center;color:#9ca3af;padding:16px">No conversation recorded</p>';
  } else {
    convoEl.innerHTML = log.map(m => {
      const role = m.role === 'user' ? 'convo-user' : 'convo-assistant';
      const label = m.role === 'user' ? 'Customer' : 'AI';
      return `
        <div class="convo-msg ${role}">
          <div class="convo-label">${label}</div>
          <div class="convo-bubble">${escapeHtml(m.content)}</div>
          ${m.ts ? `<div class="convo-time">${formatDate(m.ts)}</div>` : ''}
        </div>`;
    }).join('');
    convoEl.scrollTop = convoEl.scrollHeight;
  }

  document.getElementById('lead-modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('lead-modal').classList.add('hidden');
  currentLeadId = null;
}

async function saveLead() {
  if (!currentLeadId) return;
  const status = document.getElementById('modal-status').value;
  const notes  = document.getElementById('modal-notes').value;

  await fetch(`/api/admin/leads/${currentLeadId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status, notes }),
  });
  closeModal();
  loadLeads();
  loadStats();
}

async function deleteLead() {
  if (!currentLeadId) return;
  if (!confirm('Delete this lead? This cannot be undone.')) return;
  await fetch(`/api/admin/leads/${currentLeadId}`, { method: 'DELETE' });
  closeModal();
  loadLeads();
  loadStats();
}

async function sendManualSMS() {
  const input = document.getElementById('modal-sms-input');
  const msg   = input.value.trim();
  if (!msg || !currentLeadId) return;

  await fetch(`/api/admin/leads/${currentLeadId}/sms`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: msg }),
  });
  input.value = '';
  alert('SMS sent!');
}

// Close modal on backdrop click
document.addEventListener('click', e => {
  if (e.target.id === 'lead-modal') closeModal();
});

/* ─── Settings ────────────────────────────────────────────────────────────────── */
async function loadSettings() {
  const res = await fetch('/api/admin/settings');
  settingsCache = await res.json();
  const s = settingsCache;

  setVal('s-name',       s.name);
  setVal('s-tagline',    s.tagline);
  setVal('s-phone',      s.phone);
  setVal('s-owner-phone',s.ownerPhone);
  setVal('s-owner-email',s.ownerEmail);
  setVal('s-timezone',   s.timezone);
  setVal('s-voice',      s.voice);

  renderHoursEditor(s.hours);
  renderServicesTable(s.services);

  document.getElementById('business-name-sidebar').textContent = s.name || 'Your Business';
}

function renderHoursEditor(hours) {
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const el   = document.getElementById('hours-editor');
  el.innerHTML = DAYS.map(day => {
    const h    = hours?.[day];
    const open = !!h;
    return `
      <div class="hours-row" id="hours-row-${day}">
        <span class="hours-day">${day}</span>
        <label class="toggle">
          <input type="checkbox" id="hours-open-${day}" ${open ? 'checked' : ''}
            onchange="toggleHoursDay('${day}')">
          <span class="toggle-slider"></span>
        </label>
        <span style="font-size:12px;color:#6b7280;width:32px">${open ? 'Open' : 'Closed'}</span>
        <input class="hours-time" type="time" id="hours-start-${day}" value="${h?.open || '09:00'}" ${open ? '' : 'disabled'} />
        <span style="color:#9ca3af">–</span>
        <input class="hours-time" type="time" id="hours-end-${day}"   value="${h?.close || '17:00'}" ${open ? '' : 'disabled'} />
      </div>`;
  }).join('');
}

function toggleHoursDay(day) {
  const open   = document.getElementById(`hours-open-${day}`).checked;
  const start  = document.getElementById(`hours-start-${day}`);
  const end    = document.getElementById(`hours-end-${day}`);
  const label  = document.querySelector(`#hours-row-${day} span:nth-child(3)`);
  start.disabled = !open;
  end.disabled   = !open;
  if (label) label.textContent = open ? 'Open' : 'Closed';
}

function renderServicesTable(services) {
  const body = document.getElementById('services-table-body');
  body.innerHTML = (services || []).map((s, i) => `
    <tr>
      <td><input type="text" value="${escAttr(s.name)}"     onchange="updateService(${i},'name',this.value)"     style="width:100%;border:1px solid #e5e7eb;border-radius:6px;padding:5px 8px" /></td>
      <td><input type="number" value="${s.duration || 60}" onchange="updateService(${i},'duration',+this.value)" style="width:80px;border:1px solid #e5e7eb;border-radius:6px;padding:5px 8px" /></td>
      <td><input type="number" value="${s.price || 0}"     onchange="updateService(${i},'price',+this.value)"    style="width:80px;border:1px solid #e5e7eb;border-radius:6px;padding:5px 8px" /></td>
      <td><button class="btn btn-sm btn-danger" onclick="removeService(${i})">Remove</button></td>
    </tr>`).join('');
}

function updateService(i, field, value) {
  if (!settingsCache?.services) return;
  settingsCache.services[i][field] = value;
}

function addService() {
  if (!settingsCache) settingsCache = {};
  if (!settingsCache.services) settingsCache.services = [];
  settingsCache.services.push({ name: 'New Service', duration: 60, price: 0 });
  renderServicesTable(settingsCache.services);
}

function removeService(i) {
  if (!settingsCache?.services) return;
  settingsCache.services.splice(i, 1);
  renderServicesTable(settingsCache.services);
}

async function saveSettings() {
  const DAYS = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  const hours = {};
  DAYS.forEach(day => {
    const open = document.getElementById(`hours-open-${day}`)?.checked;
    if (open) {
      hours[day] = {
        open:  document.getElementById(`hours-start-${day}`)?.value || '09:00',
        close: document.getElementById(`hours-end-${day}`)?.value   || '17:00',
      };
    } else {
      hours[day] = null;
    }
  });

  const payload = {
    name:       getVal('s-name'),
    tagline:    getVal('s-tagline'),
    phone:      getVal('s-phone'),
    ownerPhone: getVal('s-owner-phone'),
    ownerEmail: getVal('s-owner-email'),
    timezone:   getVal('s-timezone'),
    voice:      getVal('s-voice'),
    hours,
    services: settingsCache?.services || [],
  };

  const res = await fetch('/api/admin/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const status = document.getElementById('save-status');
  if (res.ok) {
    status.textContent = 'Saved!';
    document.getElementById('business-name-sidebar').textContent = payload.name;
    setTimeout(() => { status.textContent = ''; }, 3000);
  } else {
    status.textContent = 'Error saving';
    status.style.color = 'var(--red)';
  }
}

async function connectCalendar() {
  const res = await fetch('/api/admin/calendar/auth-url');
  const { url } = await res.json();
  window.open(url, '_blank');
  document.getElementById('calendar-status').textContent =
    'After authorizing, copy the refresh token from the callback page and add it to your .env file.';
}

/* ─── SMS Templates ───────────────────────────────────────────────────────────── */
async function loadTemplates() {
  const res = await fetch('/api/admin/sms-templates');
  const t   = await res.json();
  document.getElementById('tpl-confirmation').value = t.confirmation;
  document.getElementById('tpl-owner').value        = t.ownerNotification;
  document.getElementById('tpl-reminder').value     = t.reminder;
  document.getElementById('tpl-fallback').value     = t.fallback;
}

/* ─── Utilities ───────────────────────────────────────────────────────────────── */
function setVal(id, val) {
  const el = document.getElementById(id);
  if (el && val != null) el.value = val;
}
function getVal(id) {
  return document.getElementById(id)?.value || '';
}
function formatDate(str) {
  if (!str) return '—';
  return new Date(str).toLocaleString('en-US', { month: 'short', day: 'numeric',
    hour: 'numeric', minute: '2-digit' });
}
function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;');
}

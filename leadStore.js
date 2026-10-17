const fs = require('fs');
const path = require('path');

// Simple JSON-file store for prospecting leads. Statuses:
//   new → calling → (booked | callback | not_interested | no_answer | do_not_call | failed)
const DATA_FILE = process.env.LEADS_FILE || path.join(__dirname, 'data', 'leads.json');

function load() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (err) {
    return [];
  }
}

function save(leads) {
  fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
  const tmp = `${DATA_FILE}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(leads, null, 2));
  fs.renameSync(tmp, DATA_FILE);
}

function normalizePhone(phone) {
  if (!phone) return null;
  const digits = phone.replace(/[^\d+]/g, '');
  if (digits.startsWith('+')) return digits;
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
  return null;
}

// Adds leads that aren't already known (by place id or phone). Returns the ones added.
function addLeads(newLeads) {
  const leads = load();
  const knownPlaces = new Set(leads.map((l) => l.placeId));
  const knownPhones = new Set(leads.map((l) => l.phone));
  const added = [];

  for (const lead of newLeads) {
    const phone = normalizePhone(lead.phone);
    if (!phone || knownPlaces.has(lead.placeId) || knownPhones.has(phone)) continue;
    const record = {
      ...lead,
      phone,
      status: 'new',
      attempts: 0,
      createdAt: new Date().toISOString(),
      calls: []
    };
    leads.push(record);
    added.push(record);
    knownPlaces.add(lead.placeId);
    knownPhones.add(phone);
  }

  save(leads);
  return added;
}

function getLeads(filter = {}) {
  return load().filter((l) => !filter.status || l.status === filter.status);
}

function getLead(id) {
  return load().find((l) => l.id === id) || null;
}

function updateLead(id, changes) {
  const leads = load();
  const lead = leads.find((l) => l.id === id);
  if (!lead) return null;
  Object.assign(lead, changes, { updatedAt: new Date().toISOString() });
  save(leads);
  return lead;
}

function appendCall(id, call) {
  const leads = load();
  const lead = leads.find((l) => l.id === id);
  if (!lead) return null;
  lead.calls.push({ ...call, at: new Date().toISOString() });
  save(leads);
  return lead;
}

module.exports = { addLeads, getLeads, getLead, updateLead, appendCall, normalizePhone };

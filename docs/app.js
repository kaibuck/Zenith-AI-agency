/* ===================== Constants ===================== */

const DEFAULT_LOC = { lat: 50.7612, lon: -1.2982 }; // The Solent, Cowes UK
const SEARCH_RADIUS_M = 8000; // ~4.3 nm

const OVERPASS_ENDPOINTS = [
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass-api.de/api/interpreter',
  'https://overpass.openstreetmap.fr/api/interpreter',
];

const SEAMARK_TYPES = [
  'buoy_lateral', 'buoy_cardinal', 'buoy_isolated_danger', 'buoy_safe_water',
  'buoy_special_purpose', 'beacon_lateral', 'beacon_cardinal',
  'beacon_isolated_danger', 'beacon_safe_water', 'beacon_special_purpose',
  'light_major', 'light_minor',
];

const COMPASS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];

// Base polar speed (kt) at a reference true wind speed of 10kt, by true wind angle (deg).
const POLAR_BASE = [
  { twa: 0,   bs: 0.0 },
  { twa: 30,  bs: 0.0 },
  { twa: 38,  bs: 3.8 },
  { twa: 42,  bs: 5.2 },
  { twa: 45,  bs: 5.7 },
  { twa: 52,  bs: 6.1 },
  { twa: 60,  bs: 6.4 },
  { twa: 75,  bs: 6.7 },
  { twa: 90,  bs: 6.8 },
  { twa: 110, bs: 6.7 },
  { twa: 120, bs: 6.4 },
  { twa: 135, bs: 5.8 },
  { twa: 150, bs: 5.0 },
  { twa: 165, bs: 4.2 },
  { twa: 180, bs: 3.7 },
];

// Multiplier on POLAR_BASE depending on actual true wind speed (kt).
const WIND_FACTOR = [
  { tws: 4,  f: 0.45 },
  { tws: 6,  f: 0.68 },
  { tws: 8,  f: 0.86 },
  { tws: 10, f: 1.00 },
  { tws: 12, f: 1.09 },
  { tws: 14, f: 1.15 },
  { tws: 16, f: 1.19 },
  { tws: 20, f: 1.22 },
  { tws: 25, f: 1.18 },
  { tws: 30, f: 1.10 },
  { tws: 40, f: 0.95 },
];

// Per-boat-type tweaks: overall speed factor + a shift applied to the TWA axis
// (negative = points higher / sails deeper than the baseline polar).
const BOAT_TYPES = {
  cruiser:      { factor: 0.85, angleShift: 3 },
  cruiserracer: { factor: 1.00, angleShift: 0 },
  sportboat:    { factor: 1.20, angleShift: -3 },
  dinghy:       { factor: 0.95, angleShift: -2 },
};

// Reference sail-area-to-LWL^2 ratio (ft^2/ft^2) used to judge whether a
// given boat is over/under-canvassed compared to a "typical" example of its type.
const REF_SA_RATIO = { cruiser: 0.55, cruiserracer: 0.65, sportboat: 0.85, dinghy: 1.30 };

// Reference draft-to-LWL ratio used to judge pointing ability.
const REF_DRAFT_RATIO = 0.15;

const BOAT_PROFILE_KEY = 'vmgRouterBoatProfile';

/* ===================== Math helpers ===================== */

const toRad = d => d * Math.PI / 180;
const toDeg = r => r * 180 / Math.PI;
const clamp = (x, min, max) => Math.max(min, Math.min(max, x));

function haversineNm(a, b) {
  const R = 3440.065; // nautical miles
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function initialBearing(a, b) {
  const lat1 = toRad(a.lat), lat2 = toRad(b.lat);
  const dLon = toRad(b.lon - a.lon);
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

// Unsigned angle between two compass bearings, 0-180.
function angleDiff(a, b) {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

function compassPoint(deg) {
  return COMPASS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];
}

function fmtTime(hours) {
  if (!isFinite(hours)) return '—';
  const totalMin = Math.round(hours * 60);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

/* ===================== Polar / VMG ===================== */

function lerp1D(table, xKey, yKey, x) {
  if (x <= table[0][xKey]) return table[0][yKey];
  if (x >= table[table.length - 1][xKey]) return table[table.length - 1][yKey];
  for (let i = 0; i < table.length - 1; i++) {
    const a = table[i], b = table[i + 1];
    if (x >= a[xKey] && x <= b[xKey]) {
      const t = (x - a[xKey]) / (b[xKey] - a[xKey]);
      return a[yKey] + t * (b[yKey] - a[yKey]);
    }
  }
  return table[table.length - 1][yKey];
}

// Derives speed/angle adjustments from the optional "My Boat" profile
// (waterline length, draft, sail areas) on top of the selected boat type.
function boatModifiers(boatType, profile) {
  const cfg = BOAT_TYPES[boatType] || BOAT_TYPES.cruiserracer;
  const mods = { factor: cfg.factor, angleShift: cfg.angleShift, hullSpeedCap: Infinity, downwindBoost: 1 };
  if (!profile || !profile.lwl) return mods;

  mods.hullSpeedCap = 1.34 * Math.sqrt(profile.lwl);

  const upwindSail = (profile.main || 0) + (profile.jib || 0);
  if (upwindSail > 0) {
    const saRatio = upwindSail / (profile.lwl * profile.lwl);
    const refRatio = REF_SA_RATIO[boatType] || REF_SA_RATIO.cruiserracer;
    mods.factor *= clamp(saRatio / refRatio, 0.75, 1.25);
  }

  if (profile.draft) {
    const draftRatio = profile.draft / profile.lwl;
    mods.angleShift += clamp((REF_DRAFT_RATIO - draftRatio) * 60, -4, 4);
  }

  if (profile.spin > 0 && upwindSail > 0) {
    mods.downwindBoost = clamp(1 + (profile.spin / upwindSail) * 0.25, 1, 1.35);
  }

  return mods;
}

function boatSpeed(twa, tws, boatType, profile) {
  const mods = boatModifiers(boatType, profile);
  const effTwa = clamp(twa + mods.angleShift, 0, 180);
  const base = lerp1D(POLAR_BASE, 'twa', 'bs', effTwa);
  const wf = lerp1D(WIND_FACTOR, 'tws', 'f', tws);
  let speed = base * wf * mods.factor;
  if (twa > 100) speed *= mods.downwindBoost;
  return clamp(speed, 0, mods.hullSpeedCap);
}

function bestUpwindVMG(tws, boatType, profile) {
  let best = { vmg: -Infinity, twa: 42, speed: 0 };
  for (let twa = 28; twa <= 65; twa += 0.5) {
    const sp = boatSpeed(twa, tws, boatType, profile);
    const vmg = sp * Math.cos(toRad(twa));
    if (vmg > best.vmg) best = { vmg, twa, speed: sp };
  }
  return best;
}

function bestDownwindVMG(tws, boatType, profile) {
  let best = { vmg: -Infinity, twa: 150, speed: 0 };
  for (let twa = 120; twa <= 180; twa += 0.5) {
    const sp = boatSpeed(twa, tws, boatType, profile);
    const vmg = sp * Math.cos(toRad(180 - twa));
    if (vmg > best.vmg) best = { vmg, twa, speed: sp };
  }
  return best;
}

/* ===================== Leg calculation ===================== */

function calcLeg(from, to, windDirFrom, windSpeedKt, currentDirTo, currentSpeedKt, boatType, profile) {
  const bearing = initialBearing(from, to);
  const distNm = haversineNm(from, to);
  const twa = angleDiff(bearing, windDirFrom);

  const up = bestUpwindVMG(windSpeedKt, boatType, profile);
  const down = bestDownwindVMG(windSpeedKt, boatType, profile);

  let mode, boatSpd, vmgComponent, sailTwa;
  if (twa < up.twa) {
    mode = 'beat';
    boatSpd = up.speed;
    vmgComponent = up.vmg;
    sailTwa = up.twa;
  } else if (twa > down.twa) {
    mode = 'run';
    boatSpd = down.speed;
    vmgComponent = down.vmg;
    sailTwa = down.twa;
  } else {
    mode = 'reach';
    boatSpd = boatSpeed(twa, windSpeedKt, boatType, profile);
    vmgComponent = boatSpd;
    sailTwa = twa;
  }

  let currentComponent = 0;
  if (currentSpeedKt > 0) {
    currentComponent = currentSpeedKt * Math.cos(toRad(angleDiff(bearing, currentDirTo)));
  }

  const totalVmg = vmgComponent + currentComponent;
  const timeHours = totalVmg <= 0.05 ? Infinity : distNm / totalVmg;

  return { bearing, distNm, twa, mode, sailTwa, boatSpd, vmgComponent, currentComponent, totalVmg, timeHours };
}

/* ===================== App state ===================== */

let map, userMarker, courseLine, legLabelLayer;
let userLoc = { ...DEFAULT_LOC };
let conditions = {
  wind: { speed: 8, dir: 270, gust: null },
  current: { speed: 0, dir: 0, available: false, wave: null },
};
let course = []; // [{ id, lat, lon, name, marker }]
let markMarkers = new Map(); // id -> { marker, tags, lat, lon, name }

/* ===================== Map setup ===================== */

function initMap() {
  map = L.map('map', { zoomControl: true }).setView([userLoc.lat, userLoc.lon], 13);

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map);

  L.tileLayer('https://tiles.openseamap.org/seamark/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: 'Seamarks &copy; OpenSeaMap contributors',
  }).addTo(map);

  legLabelLayer = L.layerGroup().addTo(map);
  courseLine = L.polyline([], { color: '#22d3ee', weight: 3, dashArray: '6 6' }).addTo(map);

  placeUserMarker();
  refreshAll();
}

function placeUserMarker() {
  if (userMarker) userMarker.remove();
  userMarker = L.marker([userLoc.lat, userLoc.lon], {
    icon: L.divIcon({
      className: '',
      html: '<div style="width:18px;height:18px;border-radius:50%;background:#22d3ee;border:3px solid #0b1d33;box-shadow:0 0 0 2px #22d3ee;"></div>',
      iconSize: [18, 18],
      iconAnchor: [9, 9],
    }),
  }).addTo(map).bindPopup('Start position');
}

/* ===================== Conditions (wind & current) ===================== */

async function loadConditions(loc) {
  const statusEl = document.getElementById('condStatus');
  statusEl.textContent = 'Loading live conditions…';

  try {
    const windRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=wind_speed_10m,wind_direction_10m,wind_gusts_10m&wind_speed_unit=kn`);
    const windData = await windRes.json();
    conditions.wind = {
      speed: windData.current.wind_speed_10m,
      dir: windData.current.wind_direction_10m,
      gust: windData.current.wind_gusts_10m,
    };
  } catch (e) {
    statusEl.textContent = 'Could not load wind data — using manual values.';
  }

  try {
    const marRes = await fetch(`https://marine-api.open-meteo.com/v1/marine?latitude=${loc.lat}&longitude=${loc.lon}&current=ocean_current_velocity,ocean_current_direction,wave_height`);
    const marData = await marRes.json();
    const c = marData.current || {};
    if (c.ocean_current_velocity != null) {
      conditions.current = {
        speed: c.ocean_current_velocity * 0.539957, // km/h -> kt
        dir: c.ocean_current_direction,
        wave: c.wave_height,
        available: true,
      };
    } else {
      conditions.current = { speed: 0, dir: 0, available: false, wave: c.wave_height ?? null };
    }
  } catch (e) {
    conditions.current = { speed: 0, dir: 0, available: false, wave: null };
  }

  if (!document.getElementById('windSpeedOverride').value) {
    document.getElementById('windSpeedOverride').value = conditions.wind.speed.toFixed(1);
    document.getElementById('windDirOverride').value = Math.round(conditions.wind.dir);
  }
  if (!document.getElementById('curSpeedOverride').value) {
    document.getElementById('curSpeedOverride').value = conditions.current.speed.toFixed(1);
    document.getElementById('curDirOverride').value = Math.round(conditions.current.dir || 0);
  }

  renderConditions();
  statusEl.textContent = conditions.current.available
    ? 'Live wind & current loaded.'
    : 'Live wind loaded. No ocean current data here (inland water?) — set manually if needed.';
}

function renderConditions() {
  const c = getActiveConditions();

  const windText = document.getElementById('windText');
  const windArrow = document.getElementById('windArrow');
  windText.textContent = `${c.wind.speed.toFixed(1)} kt from ${Math.round(c.wind.dir)}° (${compassPoint(c.wind.dir)})`
    + (conditions.wind.gust ? ` · gusts ${conditions.wind.gust.toFixed(0)} kt` : '');
  // Arrow points in the direction the wind is blowing TOWARD.
  windArrow.style.transform = `rotate(${(c.wind.dir + 180) % 360}deg)`;

  const curText = document.getElementById('currentText');
  const curArrow = document.getElementById('currentArrow');
  if (c.current.speed > 0.05) {
    curText.textContent = `${c.current.speed.toFixed(1)} kt to ${Math.round(c.current.dir)}° (${compassPoint(c.current.dir)})`;
    curArrow.style.transform = `rotate(${c.current.dir}deg)`;
  } else {
    curText.textContent = 'None / negligible';
    curArrow.style.transform = 'rotate(0deg)';
  }

  const waveText = document.getElementById('waveText');
  waveText.textContent = (conditions.current.wave != null) ? `${conditions.current.wave.toFixed(1)} m` : 'No data';
}

function getActiveConditions() {
  const useOverride = document.getElementById('useOverride').checked;
  if (!useOverride) return conditions;
  return {
    wind: {
      speed: parseFloat(document.getElementById('windSpeedOverride').value) || 0,
      dir: parseFloat(document.getElementById('windDirOverride').value) || 0,
      gust: conditions.wind.gust,
    },
    current: {
      speed: parseFloat(document.getElementById('curSpeedOverride').value) || 0,
      dir: parseFloat(document.getElementById('curDirOverride').value) || 0,
      available: true,
      wave: conditions.current.wave,
    },
  };
}

/* ===================== Boat profile (length, draft, sails) ===================== */

function getBoatProfile() {
  return {
    lwl: parseFloat(document.getElementById('boatLwl').value) || null,
    draft: parseFloat(document.getElementById('boatDraft').value) || null,
    main: parseFloat(document.getElementById('sailMain').value) || 0,
    jib: parseFloat(document.getElementById('sailJib').value) || 0,
    spin: parseFloat(document.getElementById('sailSpin').value) || 0,
  };
}

function saveBoatProfile() {
  const data = {
    boatType: document.getElementById('boatType').value,
    lwl: document.getElementById('boatLwl').value,
    draft: document.getElementById('boatDraft').value,
    main: document.getElementById('sailMain').value,
    jib: document.getElementById('sailJib').value,
    spin: document.getElementById('sailSpin').value,
  };
  try { localStorage.setItem(BOAT_PROFILE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
}

function loadBoatProfile() {
  let data;
  try { data = JSON.parse(localStorage.getItem(BOAT_PROFILE_KEY)); } catch (e) { return; }
  if (!data) return;
  if (data.boatType) document.getElementById('boatType').value = data.boatType;
  document.getElementById('boatLwl').value = data.lwl || '';
  document.getElementById('boatDraft').value = data.draft || '';
  document.getElementById('sailMain').value = data.main || '';
  document.getElementById('sailJib').value = data.jib || '';
  document.getElementById('sailSpin').value = data.spin || '';
}

function updateBoatStats() {
  const profile = getBoatProfile();
  const statsEl = document.getElementById('boatStats');
  if (!profile.lwl) {
    statsEl.textContent = '';
    return;
  }
  const boatType = document.getElementById('boatType').value;
  const mods = boatModifiers(boatType, profile);
  const parts = [`Hull speed cap: ${mods.hullSpeedCap.toFixed(1)} kt`];
  if (profile.main || profile.jib) parts.push(`Sail-area factor: ${mods.factor.toFixed(2)}×`);
  if (profile.draft) parts.push(`Pointing adjustment: ${mods.angleShift >= 0 ? '+' : ''}${mods.angleShift.toFixed(1)}°`);
  if (profile.spin) parts.push(`Downwind boost: ${mods.downwindBoost.toFixed(2)}×`);
  statsEl.textContent = parts.join(' · ');
}

/* ===================== Seamarks ===================== */

function seamarkStyle(tags) {
  const type = tags['seamark:type'] || '';
  let color = '#9ca3af';

  const colourTag = tags[`seamark:${type}:colour`];
  const category = tags[`seamark:${type}:category`];

  if (colourTag) {
    const first = colourTag.split(';')[0];
    const map = {
      red: '#dc2626', green: '#16a34a', yellow: '#facc15',
      black: '#1f2937', white: '#f8fafc', orange: '#f97316', blue: '#3b82f6',
    };
    color = map[first] || color;
  } else if (category === 'port') color = '#dc2626';
  else if (category === 'starboard') color = '#16a34a';
  else if (['north', 'south', 'east', 'west'].includes(category)) color = '#facc15';
  else if (type.startsWith('light')) color = '#facc15';
  else if (type === 'buoy_safe_water' || type === 'beacon_safe_water') color = '#dc2626';
  else if (type === 'buoy_isolated_danger' || type === 'beacon_isolated_danger') color = '#1f2937';

  return { color };
}

function prettyType(tags) {
  const type = tags['seamark:type'] || 'mark';
  const base = type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
  const category = tags[`seamark:${type}:category`];
  return category ? `${base} (${category.replace(/\b\w/g, c => c.toUpperCase())})` : base;
}

function markName(tags) {
  return tags['seamark:name'] || tags['name'] || prettyType(tags);
}

function buildIcon(color, badgeNum) {
  const badge = badgeNum ? `<div class="mark-badge">${badgeNum}</div>` : '';
  return L.divIcon({
    className: '',
    html: `<div style="position:relative;width:16px;height:16px;">
             <div class="mark-icon${badgeNum ? ' in-course' : ''}" style="width:16px;height:16px;background:${color};"></div>
             ${badge}
           </div>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

async function loadSeamarks(loc) {
  const statusEl = document.getElementById('locStatus');
  const typeFilter = SEAMARK_TYPES.join('|');
  const query = `[out:json][timeout:25];(node["seamark:type"~"${typeFilter}"](around:${SEARCH_RADIUS_M},${loc.lat},${loc.lon}););out body;`;

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const res = await fetch(endpoint, { method: 'POST', body: 'data=' + encodeURIComponent(query) });
      if (!res.ok) continue;
      const data = await res.json();
      if (!data.elements) continue;
      renderSeamarks(data.elements);
      statusEl.textContent = `Found ${data.elements.length} mark${data.elements.length === 1 ? '' : 's'} within ~4nm. Tap one to add it to your course.`;
      return;
    } catch (e) {
      // try next mirror
    }
  }
  statusEl.textContent = 'Could not load channel marks (network/Overpass issue). Try again shortly.';
}

function renderSeamarks(elements) {
  // Remove old mark layers (but keep ones currently in the course so the route stays valid)
  for (const [id, entry] of markMarkers.entries()) {
    if (!course.find(c => c.id === id)) {
      entry.marker.remove();
      markMarkers.delete(id);
    }
  }

  for (const el of elements) {
    if (markMarkers.has(el.id)) continue;
    const tags = el.tags || {};
    const { color } = seamarkStyle(tags);
    const name = markName(tags);
    const marker = L.marker([el.lat, el.lon], { icon: buildIcon(color, null) }).addTo(map);
    marker.bindPopup('');
    marker.on('click', () => toggleCourseMark(el.id));

    markMarkers.set(el.id, { marker, tags, lat: el.lat, lon: el.lon, name });
    updateMarkerVisual(el.id);
  }
}

function updateMarkerVisual(id) {
  const entry = markMarkers.get(id);
  if (!entry) return;
  const idx = course.findIndex(c => c.id === id);
  const { color } = seamarkStyle(entry.tags);
  entry.marker.setIcon(buildIcon(color, idx >= 0 ? idx + 1 : null));
  const status = idx >= 0 ? `<br><strong>Leg ${idx + 1} of your course</strong>` : '<br><em>Tap to add to course</em>';
  entry.marker.setPopupContent(`<strong>${entry.name}</strong><br>${prettyType(entry.tags)}${status}`);
}

/* ===================== Course management ===================== */

function toggleCourseMark(id) {
  const entry = markMarkers.get(id);
  if (!entry) return;
  const idx = course.findIndex(c => c.id === id);
  if (idx >= 0) {
    course.splice(idx, 1);
  } else {
    course.push({ id, lat: entry.lat, lon: entry.lon, name: entry.name });
  }
  // refresh badge numbers on all affected marks
  for (const c of [...course, { id }]) updateMarkerVisual(c.id);
  entry.marker.openPopup();
  updateCourseUI();
  recalcRoute();
}

function removeFromCourse(id) {
  course = course.filter(c => c.id !== id);
  for (const [mid] of markMarkers) updateMarkerVisual(mid);
  updateCourseUI();
  recalcRoute();
}

function updateCourseUI() {
  const list = document.getElementById('courseList');
  if (course.length === 0) {
    list.innerHTML = '';
    return;
  }
  list.innerHTML = course.map((c, i) => `
    <li>
      <span class="badge">${i + 1}</span>
      <span class="name">${c.name}</span>
      <button class="remove" data-id="${c.id}" title="Remove">✕</button>
    </li>
  `).join('');
  list.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => removeFromCourse(JSON.parse(btn.dataset.id)));
  });
}

/* ===================== Route calc & rendering ===================== */

function recalcRoute() {
  const resultsEl = document.getElementById('results');
  legLabelLayer.clearLayers();

  if (course.length === 0) {
    resultsEl.innerHTML = '<p class="hint">Add marks to your course to see leg-by-leg VMG and ETA.</p>';
    courseLine.setLatLngs([]);
    return;
  }

  const c = getActiveConditions();
  const boatType = document.getElementById('boatType').value;
  const profile = getBoatProfile();
  const points = [userLoc, ...course.map(m => ({ lat: m.lat, lon: m.lon }))];

  let rows = '';
  let totalH = 0;
  let anyInfinite = false;

  for (let i = 0; i < course.length; i++) {
    const leg = calcLeg(points[i], points[i + 1], c.wind.dir, c.wind.speed, c.current.dir, c.current.speed, boatType, profile);
    if (isFinite(leg.timeHours)) totalH += leg.timeHours; else anyInfinite = true;

    const modeLabel = { beat: 'Beat ⇆', run: 'Run ⇆', reach: 'Reach →' }[leg.mode];
    rows += `<tr>
      <td>${i + 1}</td>
      <td>${course[i].name}</td>
      <td>${leg.distNm.toFixed(2)}</td>
      <td>${Math.round(leg.bearing)}°</td>
      <td>${Math.round(leg.twa)}°</td>
      <td class="mode-${leg.mode}">${modeLabel}</td>
      <td>${leg.boatSpd.toFixed(1)}</td>
      <td>${leg.totalVmg.toFixed(1)}</td>
      <td>${fmtTime(leg.timeHours)}</td>
    </tr>`;

    // midpoint label on the map
    const mid = { lat: (points[i].lat + points[i + 1].lat) / 2, lon: (points[i].lon + points[i + 1].lon) / 2 };
    L.marker([mid.lat, mid.lon], {
      icon: L.divIcon({
        className: '',
        html: `<div class="leg-label">L${i + 1} · ${leg.distNm.toFixed(1)}nm · ${fmtTime(leg.timeHours)}</div>`,
        iconSize: null,
      }),
      interactive: false,
    }).addTo(legLabelLayer);
  }

  resultsEl.innerHTML = `
    <table>
      <thead><tr>
        <th>#</th><th>Mark</th><th>Dist (nm)</th><th>Brg</th><th>TWA</th><th>Plan</th><th>Speed (kt)</th><th>VMG (kt)</th><th>Time</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="8">Total time</td><td>${anyInfinite ? '— (adverse leg)' : fmtTime(totalH)}</td></tr></tfoot>
    </table>
    <p class="hint">Beat/Run legs assume optimal tacking/gybing angles, so VMG already accounts for the extra distance sailed.</p>
  `;

  courseLine.setLatLngs(points.map(p => [p.lat, p.lon]));
}

/* ===================== Top-level refresh ===================== */

async function refreshAll() {
  document.getElementById('latInput').value = userLoc.lat.toFixed(4);
  document.getElementById('lonInput').value = userLoc.lon.toFixed(4);
  await loadConditions(userLoc);
  await loadSeamarks(userLoc);
  recalcRoute();
}

function setLocation(lat, lon, label) {
  userLoc = { lat, lon };
  map.setView([lat, lon], 13);
  placeUserMarker();
  document.getElementById('locStatus').textContent = label || 'Loading marks…';
  refreshAll();
}

/* ===================== UI wiring ===================== */

document.getElementById('locateBtn').addEventListener('click', () => {
  const statusEl = document.getElementById('locStatus');
  if (!navigator.geolocation) {
    statusEl.textContent = 'Geolocation not supported by this browser.';
    return;
  }
  statusEl.textContent = 'Requesting your location…';
  navigator.geolocation.getCurrentPosition(
    pos => setLocation(pos.coords.latitude, pos.coords.longitude, 'Located you. Loading marks…'),
    () => { statusEl.textContent = 'Location permission denied — enter coordinates manually or use the default.'; },
    { enableHighAccuracy: true, timeout: 10000 }
  );
});

document.getElementById('goBtn').addEventListener('click', () => {
  const lat = parseFloat(document.getElementById('latInput').value);
  const lon = parseFloat(document.getElementById('lonInput').value);
  if (isFinite(lat) && isFinite(lon)) setLocation(lat, lon, 'Loading marks…');
});

document.getElementById('boatType').addEventListener('change', () => { saveBoatProfile(); updateBoatStats(); recalcRoute(); });
['boatLwl', 'boatDraft', 'sailMain', 'sailJib', 'sailSpin'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => { saveBoatProfile(); updateBoatStats(); recalcRoute(); });
});

document.getElementById('useOverride').addEventListener('change', () => { renderConditions(); recalcRoute(); });
['windSpeedOverride', 'windDirOverride', 'curSpeedOverride', 'curDirOverride'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (document.getElementById('useOverride').checked) { renderConditions(); recalcRoute(); }
  });
});

document.getElementById('clearBtn').addEventListener('click', () => {
  course = [];
  for (const [id] of markMarkers) updateMarkerVisual(id);
  updateCourseUI();
  recalcRoute();
});

/* ===================== Boot ===================== */

loadBoatProfile();
updateBoatStats();
initMap();

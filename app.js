'use strict';
/* VHIS Plan Finder — client-side agent tool. Loads the slim SQLite DB via
   sql.js and answers premium/coverage queries entirely in the browser. */

let db = null;
let PRODUCTS = [];        // all products (rows)
let LAST_RESULTS = [];    // current sorted result set (for export)
const state = {
  age: 35, gender: 'M', freq: 'annual', currency: 'HKD', smoker: false,
  search: '', insurer: '', ptype: '', openOnly: true, smmOnly: false,
  sortKey: 'premium', sortDir: 1,
  compare: new Set(),     // product_ids selected for side-by-side
};

// ---- helpers ----
const $ = (s) => document.querySelector(s);
function q(sql, params = []) {
  const st = db.prepare(sql); st.bind(params);
  const out = []; while (st.step()) out.push(st.getAsObject()); st.free(); return out;
}
function money(v, cur) {
  if (v == null) return '—';
  const sym = cur === 'USD' ? 'US$' : 'HK$';
  return sym + Math.round(v).toLocaleString('en-US');
}
function shortInsurer(n) {
  return n.replace(/\s*\([^)]*\)/g, '')
    .replace(/\b(Company|Limited|Ltd\.?|Insurance|Assurance|International)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}
function statusBadge(p) {
  const s = p.status || '';
  if (s.indexOf('De-registered') === 0) return '<span class="badge bad">De-registered</span>';
  if (s.indexOf('Renewal') === 0) return '<span class="badge warn">Renewal only</span>';
  if (s === 'Unavailable') return '<span class="badge warn">Unavailable</span>';
  return '<span class="badge ok">Open</span>';
}

// ---- indicative premium for the current client, per product ----
// Rows already filtered to the age/frequency/table_index=0. Pick the client's
// gender (fall back to unisex), non-smoker unless smoker toggled, and combine
// components: a single "base", else basic (+rider if present).
function pickPremium(rows) {
  const g = rows.some(r => r.gender === state.gender) ? state.gender : 'U';
  const smokPref = state.smoker ? 'Y' : 'N';
  let cand = rows.filter(r => r.gender === g);
  const smk = cand.some(r => r.smoker === smokPref) ? smokPref : 'NA';
  cand = cand.filter(r => r.smoker === smk || (smk === 'NA' && r.smoker === 'NA'));
  if (!cand.length) return null;
  // choose the section with the lowest total (indicative / entry point)
  const bySection = {};
  for (const r of cand) (bySection[r.section] ||= []).push(r);
  let best = null;
  for (const sec in bySection) {
    const cs = bySection[sec];
    const base = cs.find(r => r.component === 'base');
    let total;
    if (base) total = base.amount;
    else {
      const basic = cs.find(r => r.component === 'basic');
      const rider = cs.find(r => r.component === 'rider');
      if (basic && rider) total = basic.amount + rider.amount;
      else total = Math.min(...cs.map(r => r.amount));
    }
    if (best == null || total < best) best = total;
  }
  return best;
}

function computeResults() {
  const rows = q(
    `SELECT p.product_id, p.gender, p.smoker, p.component, p.section, p.amount
     FROM premiums p WHERE p.age=? AND p.frequency=? AND p.table_index=0`,
    [state.age, state.freq]);
  const byProd = {};
  for (const r of rows) (byProd[r.product_id] ||= []).push(r);

  const results = [];
  for (const p of PRODUCTS) {
    if (p.currency !== state.currency) continue;
    if (state.openOnly && p.status !== 'Open') continue;
    if (state.ptype && p.plan_type !== state.ptype) continue;
    if (state.smmOnly && !p.has_smm) continue;
    if (state.insurer && p.company_en !== state.insurer) continue;
    if (state.search) {
      const s = state.search.toLowerCase();
      if (!(p.plan_name_en + ' ' + p.company_en + ' ' + p.plan_level_en).toLowerCase().includes(s)) continue;
    }
    const prem = byProd[p.product_id] ? pickPremium(byProd[p.product_id]) : null;
    results.push({ ...p, premium: prem });
  }
  return results;
}

function render() {
  const results = computeResults();
  const dir = state.sortDir, k = state.sortKey;
  results.sort((a, b) => {
    let av, bv;
    if (k === 'premium') { av = a.premium ?? Infinity; bv = b.premium ?? Infinity; }
    else if (k === 'company') { av = a.company_en; bv = b.company_en; }
    else if (k === 'plan') { av = a.plan_name_en; bv = b.plan_name_en; }
    else { av = a.plan_level_en; bv = b.plan_level_en; }
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  LAST_RESULTS = results;
  $('#resultCount').textContent = `${results.length} plan${results.length === 1 ? '' : 's'}`;
  const body = $('#resultsBody');
  if (!results.length) { body.innerHTML = '<tr><td colspan="8" class="empty">No plans match these filters.</td></tr>'; updateCmpBar(); return; }
  body.innerHTML = results.map(r => `
    <tr data-id="${r.product_id}">
      <td class="chkcell"><input type="checkbox" ${state.compare.has(r.product_id) ? 'checked' : ''} aria-label="Compare"></td>
      <td title="${r.company_en}">${shortInsurer(r.company_en)}</td>
      <td><div class="plan-name">${r.plan_name_en}</div>${r.plan_name_zh_hk ? `<div class="plan-zh">${r.plan_name_zh_hk}</div>` : ''}</td>
      <td class="level">${r.plan_level_en || ''}</td>
      <td><span class="type-tag">${r.plan_type}</span></td>
      <td class="num premium">${r.premium == null ? '—' : money(r.premium, r.currency)}${r.premium != null ? '<small>/' + (state.freq === 'annual' ? 'yr' : 'mo') + '</small>' : ''}</td>
      <td>${statusBadge(r)}${r.tax_deductible ? ' <span class="badge tax">Tax✓</span>' : ''}</td>
      <td><span class="linkbtn">Details ›</span></td>
    </tr>`).join('');
  body.querySelectorAll('tr[data-id]').forEach(tr => {
    const cb = tr.querySelector('.chkcell input');
    cb.addEventListener('click', e => {
      e.stopPropagation();                       // don't open the drawer
      const id = tr.dataset.id;
      cb.checked ? state.compare.add(id) : state.compare.delete(id);
      updateCmpBar();
    });
    tr.addEventListener('click', () => openDrawer(tr.dataset.id));
  });
  updateCmpBar();
}

function updateCmpBar() {
  const n = state.compare.size, bar = $('#cmpbar');
  bar.hidden = n === 0;
  if (!n) return;
  $('#cmpCount').textContent = `${n} selected`;
  $('#cmpNames').textContent = [...state.compare]
    .map(id => (PRODUCTS.find(p => p.product_id === id) || {}).plan_name_en || id).join(' · ');
}

// ---- benefit ordering ----
// Schedules use sectioned codes: core items "a".."o", then supplementary
// sections "II-*", "III-*", "IV-*". Plain string sort puts "II-1" before "a"
// (uppercase sorts first) and "II-10" before "II-2", so sort by section rank
// then natural order within the section.
function sectionRank(code) {
  if (/^[a-z]$/i.test(code)) return 0;
  const m = /^([IVX]+)-/.exec(code || '');
  if (!m) return 9;
  return { I: 1, II: 2, III: 3, IV: 4, V: 5 }[m[1]] ?? 8;
}
function benefitOrder(a, b) {
  const ra = sectionRank(a.code), rb = sectionRank(b.code);
  if (ra !== rb) return ra - rb;
  const sa = (a.code || '').split('-').pop(), sb = (b.code || '').split('-').pop();
  const na = parseInt(sa, 10), nb = parseInt(sb, 10);
  const aNum = !isNaN(na), bNum = !isNaN(nb);
  if (aNum && bNum) return na - nb;      // II-2 before II-10
  if (aNum !== bNum) return aNum ? -1 : 1;
  return sa.localeCompare(sb);
}
function sectionTag(code) {
  const r = sectionRank(code);
  return r === 0 ? '' : '<span class="sec">supp</span> ';
}

// ---- detail drawer ----
const AGES = [1, 20, 30, 40, 50, 60, 70, 80];
function openDrawer(pid) {
  const p = PRODUCTS.find(x => x.product_id === pid);
  const base = 'https://www.vhis.gov.hk';
  // premium curve for the current gender selection
  const g = state.gender;
  const curve = q(
    `SELECT age, frequency, component, section, gender, smoker, amount FROM premiums
     WHERE product_id=? AND table_index=0 AND smoker IN (?, 'NA')
       AND gender IN (?, 'U') AND age IN (${AGES.join(',')})`,
    [pid, state.smoker ? 'Y' : 'N', g]);
  const at = (age, freq) => {
    const rows = curve.filter(r => r.age === age && r.frequency === freq);
    return rows.length ? pickPremium(rows) : null;
  };
  const nowPrem = (() => {
    const rows = q(`SELECT gender,smoker,component,section,amount FROM premiums
      WHERE product_id=? AND age=? AND frequency=? AND table_index=0`, [pid, state.age, state.freq]);
    return rows.length ? pickPremium(rows) : null;
  })();

  const benefits = q(
    `SELECT bi.code, bi.name, bi.column, bi.amount, bi.unit, bi.max_days,
            bi.complex, bi.major, bi.intermediate, bi.minor, bi.coinsurance_percent, bi.raw
     FROM benefit_items bi JOIN product_benefit pb USING(schedule_hash) WHERE pb.product_id=?`, [pid]);
  benefits.sort(benefitOrder);

  let benefitHtml;
  if (benefits.length) {
    const cols = [...new Set(benefits.map(b => b.column))].filter(c => c && c !== 'limit');
    const multi = cols.length > 1;      // e.g. Network / Non-network tiers
    if (multi) {
      // A schedule can MIX column types: core items priced per tier
      // (Network / Non-network) while supplementary items carry a single
      // "limit". Render tier values per column, and span a lone "limit".
      const byItem = new Map();
      benefits.forEach(b => {
        if (!byItem.has(b.code)) byItem.set(b.code, { name: b.name, code: b.code, v: {} });
        byItem.get(b.code).v[b.column] = b.raw || '';
      });
      benefitHtml = `<table class="mini benefit"><thead><tr><th>Benefit</th>${
        cols.map(c => `<th class="num">${c}</th>`).join('')}</tr></thead><tbody>${
        [...byItem.values()].map(it => {
          const hasTier = cols.some(c => it.v[c]);
          const cells = hasTier
            ? cols.map(c => `<td class="num">${it.v[c] || '—'}</td>`).join('')
            : `<td class="num" colspan="${cols.length}">${it.v['limit'] || '—'}</td>`;
          return `<tr><td>${sectionTag(it.code)}${it.name}</td>${cells}</tr>`;
        }).join('')}</tbody></table>`;
    } else {
      benefitHtml = `<table class="mini benefit"><tbody>${benefits.map(b =>
        `<tr><td>${sectionTag(b.code)}${b.name}</td><td class="num">${b.raw || '—'}</td></tr>`).join('')}</tbody></table>`;
    }
    const sched = q(`SELECT annual_benefit_limit, lifetime_benefit_limit FROM benefit_schedules
      WHERE schedule_hash=(SELECT schedule_hash FROM product_benefit WHERE product_id=?)`, [pid])[0];
    if (sched) benefitHtml = `<table class="mini"><tbody>
      <tr><td><b>Annual benefit limit</b></td><td class="num">${sched.annual_benefit_limit || '—'}</td></tr>
      <tr><td><b>Lifetime benefit limit</b></td><td class="num">${sched.lifetime_benefit_limit || '—'}</td></tr>
      </tbody></table>` + benefitHtml;
  } else {
    benefitHtml = `<p class="note">Structured benefit schedule not yet extracted for this plan — open the plan document below for full coverage limits.</p>`;
  }

  $('#drawerContent').innerHTML = `
    <h2 class="d-title">${p.plan_name_en}</h2>
    <p class="d-sub">${p.company_en}${p.plan_level_en ? ' · ' + p.plan_level_en : ''} · ${p.currency}</p>
    <div class="d-badges">
      <span class="type-tag">${p.plan_type} Plan</span>${statusBadge(p)}
      ${p.tax_deductible ? '<span class="badge tax">Tax-deductible</span>' : ''}
      ${p.has_smm ? '<span class="badge tax">SMM</span>' : ''}
    </div>

    <div class="d-quote">
      <span>Age ${state.age} · ${state.gender === 'M' ? 'Male' : 'Female'} · ${state.smoker ? 'Smoker' : 'Non-smoker'}</span>
      <b>${nowPrem == null ? '—' : money(nowPrem, p.currency)}</b>
      <span>/ ${state.freq === 'annual' ? 'year' : 'month'}</span>
    </div>

    <div class="d-section">Premium by age (${state.gender === 'M' ? 'male' : 'female'}, ${state.smoker ? 'smoker' : 'non-smoker'})</div>
    <table class="mini"><thead><tr><th>Age</th><th class="num">Annual</th><th class="num">Monthly</th></tr></thead>
      <tbody>${AGES.map(a => `<tr><td>${a}</td><td class="num">${money(at(a, 'annual'), p.currency)}</td><td class="num">${money(at(a, 'monthly'), p.currency)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="note">Non-guaranteed; excludes the Insurance Authority levy. Deductible/region variants may price differently — see the premium document.</p>

    <div class="d-section">Benefit schedule</div>
    ${benefitHtml}

    <div class="d-section">Official documents</div>
    <div class="doclinks">
      ${p.plan_doc_url_en ? `<a href="${base}${p.plan_doc_url_en.startsWith('http') ? '' : ''}${p.plan_doc_url_en.replace(base, '')}" target="_blank" rel="noopener">Plan document ↗</a>` : ''}
      ${p.premium_doc_url_en ? `<a href="${p.premium_doc_url_en}" target="_blank" rel="noopener">Premium table ↗</a>` : ''}
    </div>
    <p class="note">Certified ${p.plan_date_en || ''}${p.earliest_plan_date_en ? ' · earliest ' + p.earliest_plan_date_en : ''}. ID ${p.product_id}</p>`;

  $('#drawer').hidden = false; $('#drawerBackdrop').hidden = false;
}
function closeDrawer() { $('#drawer').hidden = true; $('#drawerBackdrop').hidden = true; }

// ---- compare ----
function premiumFor(pid, age, freq) {
  const rows = q(`SELECT gender,smoker,component,section,amount FROM premiums
    WHERE product_id=? AND age=? AND frequency=? AND table_index=0`, [pid, age, freq]);
  return rows.length ? pickPremium(rows) : null;
}
function benefitsFor(pid) {
  const rows = q(`SELECT bi.code, bi.name, bi.raw FROM benefit_items bi
    JOIN product_benefit pb USING(schedule_hash) WHERE pb.product_id=? ORDER BY bi.code`, [pid]);
  const m = {}; rows.forEach(r => { if (!m[r.code]) m[r.code] = r; }); return m;
}
const CMP_AGES = [30, 50, 65];
const CMP_BENEFITS = [['a', 'Room & board'], ['b', 'Miscellaneous'], ['e', 'Intensive care'],
                      ['f', "Surgeon's fee"], ['i', 'Diagnostic imaging'], ['j', 'Cancer treatment']];

function compareRows() {
  const plans = [...state.compare].map(id => PRODUCTS.find(p => p.product_id === id)).filter(Boolean);
  const ben = plans.map(p => benefitsFor(p.product_id));
  const R = [];
  R.push(['Insurer', plans.map(p => p.company_en)]);
  R.push(['Level', plans.map(p => p.plan_level_en || '—')]);
  R.push(['Type', plans.map(p => p.plan_type + ' Plan')]);
  R.push(['Currency', plans.map(p => p.currency)]);
  R.push(['Status', plans.map(p => p.status)]);
  R.push([`Premium — age ${state.age} ${state.gender === 'M' ? 'M' : 'F'} (annual)`,
          plans.map(p => money(premiumFor(p.product_id, state.age, 'annual'), p.currency)), 'big']);
  R.push([`Premium — age ${state.age} (monthly)`,
          plans.map(p => money(premiumFor(p.product_id, state.age, 'monthly'), p.currency))]);
  CMP_AGES.forEach(a => R.push([`Annual @ age ${a}`,
    plans.map(p => money(premiumFor(p.product_id, a, 'annual'), p.currency))]));
  CMP_BENEFITS.forEach(([code, label]) => {
    if (ben.some(b => b[code])) R.push([label, ben.map(b => (b[code] && b[code].raw) || '—')]);
  });
  R.push(['Tax-deductible', plans.map(p => p.tax_deductible ? 'Yes' : '—')]);
  return { plans, R };
}

function openCompare() {
  if (!state.compare.size) return;
  const { plans, R } = compareRows();
  $('#cmpTitle').textContent = `Comparison — age ${state.age}, ${state.gender === 'M' ? 'male' : 'female'}, ${state.smoker ? 'smoker' : 'non-smoker'}`;
  $('#cmpBody').innerHTML = `
    <div class="print-head"><h2>VHIS plan comparison</h2>
      <p>Client: age ${state.age} · ${state.gender === 'M' ? 'Male' : 'Female'} · ${state.smoker ? 'Smoker' : 'Non-smoker'} · ${state.currency}. Premiums non-guaranteed, excl. IA levy.</p></div>
    <table class="cmp-table"><thead><tr><th></th>${plans.map(p =>
      `<th class="cmp-plan">${p.plan_name_en}<small>${p.plan_name_zh_hk || ''}</small></th>`).join('')}</tr></thead>
      <tbody>${R.map(([label, vals, cls]) =>
        `<tr><th>${label}</th>${vals.map(v => `<td class="${cls === 'big' ? 'big' : 'num'}">${v}</td>`).join('')}</tr>`).join('')}
      </tbody></table>`;
  $('#cmpOverlay').hidden = false;
}

// ---- export ----
function csvDownload(name, rows) {
  const esc = v => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const blob = new Blob(['﻿' + rows.map(r => r.map(esc).join(',')).join('\r\n')],
                        { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}
function clientHeader() {
  return [['VHIS quote'], ['Client age', state.age], ['Gender', state.gender === 'M' ? 'Male' : 'Female'],
          ['Smoker', state.smoker ? 'Yes' : 'No'], ['Frequency', state.freq], ['Currency', state.currency],
          ['Generated', new Date().toLocaleString()], ['Note', 'Premiums non-guaranteed; exclude IA levy.'], []];
}
function exportResultsCsv() {
  const rows = clientHeader();
  rows.push(['Insurer', 'Plan', 'Chinese name', 'Level', 'Type', 'Currency',
             `Premium (${state.freq})`, 'Status', 'Tax-deductible', 'Plan document']);
  LAST_RESULTS.forEach(r => rows.push([r.company_en, r.plan_name_en, r.plan_name_zh_hk, r.plan_level_en,
    r.plan_type, r.currency, r.premium == null ? '' : Math.round(r.premium), r.status,
    r.tax_deductible ? 'Yes' : '', r.plan_doc_url_en]));
  csvDownload(`vhis-quote-age${state.age}-${state.gender}.csv`, rows);
}
function exportCompareCsv() {
  const { plans, R } = compareRows();
  const rows = clientHeader();
  rows.push(['', ...plans.map(p => p.plan_name_en)]);
  R.forEach(([label, vals]) => rows.push([label, ...vals]));
  csvDownload(`vhis-comparison-age${state.age}.csv`, rows);
}

// ---- wiring ----
function seg(id, key) {
  const el = $('#' + id);
  el.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    el.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); el.dataset.value = b.dataset.v; state[key] = b.dataset.v; render();
  }));
}
function wire() {
  $('#age').addEventListener('input', e => { state.age = Math.max(0, Math.min(100, +e.target.value || 0)); render(); });
  seg('gender', 'gender'); seg('freq', 'freq'); seg('currency', 'currency'); seg('ptype', 'ptype');
  $('#smoker').addEventListener('change', e => { state.smoker = e.target.checked; render(); });
  $('#openOnly').addEventListener('change', e => { state.openOnly = e.target.checked; render(); });
  $('#smmOnly').addEventListener('change', e => { state.smmOnly = e.target.checked; render(); });
  $('#search').addEventListener('input', e => { state.search = e.target.value; render(); });
  $('#insurer').addEventListener('change', e => { state.insurer = e.target.value; render(); });
  $('#drawerClose').addEventListener('click', closeDrawer);
  $('#drawerBackdrop').addEventListener('click', closeDrawer);
  // compare + export
  $('#cmpOpen').addEventListener('click', openCompare);
  $('#cmpClear').addEventListener('click', () => { state.compare.clear(); render(); });
  $('#cmpClose').addEventListener('click', () => { $('#cmpOverlay').hidden = true; });
  $('#cmpOverlay').addEventListener('click', e => { if (e.target.id === 'cmpOverlay') $('#cmpOverlay').hidden = true; });
  $('#cmpCsv').addEventListener('click', exportCompareCsv);
  $('#cmpPrint').addEventListener('click', () => window.print());
  $('#exportCsv').addEventListener('click', exportResultsCsv);
  $('#printQuote').addEventListener('click', () => window.print());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); $('#cmpOverlay').hidden = true; }
  });
  document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    state.sortDir = (state.sortKey === k) ? -state.sortDir : (k === 'premium' ? 1 : 1);
    state.sortKey = k;
    document.querySelectorAll('th[data-sort]').forEach(x => x.textContent = x.textContent.replace(/ [▲▼]/, ''));
    th.textContent += state.sortDir === 1 ? ' ▲' : ' ▼';
    render();
  }));
}

// The database ships gzipped (22 MB → ~3.5 MB) so the hosted demo loads fast.
// Prefer the .gz and inflate in the browser; fall back to the plain .db when
// DecompressionStream is unavailable or only the raw file is present.
async function loadDb() {
  if (typeof DecompressionStream === 'function') {
    try {
      const r = await fetch('vhis_app.db.gz');
      if (r.ok) {
        return await new Response(
          r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
      }
    } catch (e) { /* fall through to the uncompressed copy */ }
  }
  return (await fetch('vhis_app.db')).arrayBuffer();
}

async function main() {
  const SQL = await initSqlJs({ locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` });
  db = new SQL.Database(new Uint8Array(await loadDb()));
  PRODUCTS = q(`SELECT * FROM products`);
  // flags are stored as TEXT "0"/"1" (both truthy in JS) — coerce to numbers
  PRODUCTS.forEach(p => { p.has_smm = +p.has_smm; p.tax_deductible = +p.tax_deductible; p.de_registered = +p.de_registered; });

  // header stats
  const open = PRODUCTS.filter(p => p.status === 'Open').length;
  const insurers = [...new Set(PRODUCTS.map(p => p.company_en))].sort();
  $('#headerStats').innerHTML =
    `<span class="pill">${open} sellable plans</span><span class="pill">${insurers.length} insurers</span>` +
    `<span class="pill">${PRODUCTS.length} products</span>`;
  const sel = $('#insurer');
  insurers.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
  $('#dataMeta').textContent = 'Standard-plan benefits shown in full; Flexi benefits via plan document.';

  wire();
  render();
  const l = document.querySelector('.loading'); if (l) l.remove();
}

// loading overlay + boot
document.body.insertAdjacentHTML('beforeend', '<div class="loading"><div class="spin"></div></div>');
main().catch(e => {
  document.querySelector('.loading').innerHTML = '<p style="color:var(--bad);max-width:420px;text-align:center">Failed to load data: ' + e.message + '</p>';
  console.error(e);
});

'use strict';
/* VHIS Plan Finder — client-side agent tool. Loads the slim SQLite DB via
   sql.js and answers premium/coverage queries entirely in the browser. */

let db = null;
let PRODUCTS = [];        // all products (rows)
let LAST_RESULTS = [];    // current sorted result set (for export)
let CURRENT_PID = null;   // product shown in the drawer (re-rendered on language switch)
let TAXO = null;          // benefit_taxonomy.json — the canonical 12 + 37 slot grid
let BASICS = null;        // plan_basics.json — ward class, deductible, territorial scope
const state = {
  age: 35, gender: 'M', freq: 'annual', currency: 'HKD', smoker: false,
  search: '', insurer: '', ptype: '', openOnly: true, smmOnly: false,
  sortKey: 'premium', sortDir: 1,
  compare: new Set(),     // product_ids selected for side-by-side
  gapProc: '',            // benchmark procedure for the coverage-gap estimate
  tier: 'non-network',    // provider tier for plans that publish two sets of limits
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
/* Render a quote from premium-model. A plan that is not open to a new applicant
   of this age gets a stated reason, not a dash — the agent needs to know the
   difference between "no data" and "cannot be sold to this client". */
function quoteText(quote, cur) {
  if (!quote) return '—';
  if (quote.unavailable) return `<span class="unavail" title="${tr('premClosedHint')}">${tr('premClosed')}</span>`;
  return money(quote.amount, cur);
}
// ---- language-aware field pickers ----
const sfx = () => (LANG === 'hk' ? '_zh_hk' : LANG === 'cn' ? '_zh_cn' : '_en');
const pick = (p, base) => (p[base + sfx()] || p[base + '_en'] || '');
const pName = p => pick(p, 'plan_name');
const pCompany = p => pick(p, 'company');
const pLevel = p => pick(p, 'plan_level');
const pPlanDoc = p => (LANG === 'en' ? p.plan_doc_url_en : (p.plan_doc_url_zh_hk || p.plan_doc_url_en));
const pPremDoc = p => (LANG === 'en' ? p.premium_doc_url_en : (p.premium_doc_url_zh_hk || p.premium_doc_url_en));
// secondary line under the plan name: show the other script for cross-reference
const pAlt = p => (LANG === 'en' ? (p.plan_name_zh_hk || '') : p.plan_name_en);

function shortInsurer(n) {
  if (LANG !== 'en') return n.replace(/（[^）]*）/g, '').replace(/有限公司$/, '').trim() || n;
  return n.replace(/\s*\([^)]*\)/g, '')
    .replace(/\b(Company|Limited|Ltd\.?|Insurance|Assurance|International)\b/gi, ' ')
    .replace(/\s{2,}/g, ' ').trim();
}
function statusText(p) {
  const s = p.status || '';
  if (s.indexOf('De-registered') === 0) return ['bad', tr('stDereg')];
  if (s.indexOf('Renewal') === 0) return ['warn', tr('stRenewal')];
  if (s === 'Unavailable') return ['warn', tr('stUnavail')];
  return ['ok', tr('stOpen')];
}
function statusBadge(p) {
  const [cls, txt] = statusText(p);
  return `<span class="badge ${cls}">${txt}</span>`;
}

// ---- indicative premium for the current client, per product ----
// The selection rule lives in premium-model.js, which is pure and unit-tested:
// basic and rider are alternatives rather than a sum, renewal-only rows are
// excluded, and the entry-age band must actually admit the client.
const quoteFor = (rows) =>
  pickPremium(rows, { age: state.age, gender: state.gender, smoker: state.smoker });

function computeResults() {
  const rows = q(
    `SELECT p.product_id, p.gender, p.smoker, p.component, p.section, p.amount,
            p.age_flag, p.age, p.age_basis
     FROM premiums p WHERE p.age IN (?, ?) AND p.frequency=?`,
    [state.age, state.age + 1, state.freq]);
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
      // search every language so a Chinese query finds an English-named plan too
      const hay = [p.plan_name_en, p.plan_name_zh_hk, p.plan_name_zh_cn, p.company_en,
                   p.company_zh_hk, p.company_zh_cn, p.plan_level_en, p.plan_level_zh_hk,
                   p.plan_level_zh_cn].join(' ').toLowerCase();
      if (!hay.includes(s)) continue;
    }
    const quote = byProd[p.product_id] ? quoteFor(byProd[p.product_id]) : null;
    results.push({ ...p, quote, premium: quote && !quote.unavailable ? quote.amount : null });
  }
  return results;
}

function render() {
  const results = computeResults();
  const dir = state.sortDir, k = state.sortKey;
  results.sort((a, b) => {
    let av, bv;
    if (k === 'premium') { av = a.premium ?? Infinity; bv = b.premium ?? Infinity; }
    else if (k === 'company') { av = pCompany(a); bv = pCompany(b); }
    else if (k === 'plan') { av = pName(a); bv = pName(b); }
    else { av = pLevel(a); bv = pLevel(b); }
    return (av < bv ? -1 : av > bv ? 1 : 0) * dir;
  });

  LAST_RESULTS = results;
  $('#resultCount').textContent = tr('plans', results.length);
  const body = $('#resultsBody');
  if (!results.length) { body.innerHTML = `<tr><td colspan="8" class="empty">${tr('noMatch')}</td></tr>`; updateCmpBar(); return; }
  const typeLbl = t => (t === 'Standard' ? tr('standard') : tr('flexi'));
  body.innerHTML = results.map(r => `
    <tr data-id="${r.product_id}">
      <td class="chkcell"><input type="checkbox" ${state.compare.has(r.product_id) ? 'checked' : ''} aria-label="${tr('compare')}"></td>
      <td title="${pCompany(r)}">${shortInsurer(pCompany(r))}</td>
      <td><div class="plan-name">${pName(r)}</div>${pAlt(r) ? `<div class="plan-zh">${pAlt(r)}</div>` : ''}</td>
      <td class="level">${pLevel(r)}</td>
      <td><span class="type-tag">${typeLbl(r.plan_type)}</span></td>
      <td class="num premium">${quoteText(r.quote, r.currency)}${r.premium != null ? '<small>' + (state.freq === 'annual' ? tr('perYr') : tr('perMo')) + '</small>' : ''}</td>
      <td>${statusBadge(r)}${r.tax_deductible ? ` <span class="badge tax">${tr('tax')}</span>` : ''}</td>
      <td><span class="linkbtn">${tr('details')} ›</span></td>
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
  $('#cmpCount').textContent = LANG === 'en' ? `${n} ${tr('selected')}` : `${n} ${tr('selected')}`;
  $('#cmpNames').textContent = [...state.compare]
    .map(id => { const p = PRODUCTS.find(x => x.product_id === id); return p ? pName(p) : id; }).join(' · ');
}


// ---- footnote markers ----------------------------------------------------
// Benefit limits carry markers like "Full cover(6)". The marker points into
// THAT document's own numbered notes, and the qualification usually lives
// there rather than in the limit: Blue Cross note (6) defines full cover as
// "no itemised benefit sublimit ... subject to the Annual Benefit Limit and
// Lifetime Benefit Limit" — i.e. not unlimited. Numbering is per document, so
// a plan may only ever be shown its own notes.
let NOTE_CACHE = {};
const schedHash = (pid) =>
  (q('SELECT schedule_hash FROM product_benefit WHERE product_id=?', [pid])[0] || {}).schedule_hash;
function notesFor(scheduleHash) {
  if (!scheduleHash) return {};
  if (NOTE_CACHE[scheduleHash]) return NOTE_CACHE[scheduleHash];
  const out = {};
  for (const r of q('SELECT num, text FROM benefit_notes WHERE schedule_hash=?', [scheduleHash]))
    out[r.num] = r.text;
  return (NOTE_CACHE[scheduleHash] = out);
}
const esc = (t) => String(t).replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/** Make every "(n)" in a rendered limit hoverable, where the plan defines n. */
function withNotes(html, notes) {
  if (!html || !notes || !Object.keys(notes).length) return html;
  return String(html).replace(/\((\d{1,2})\)/g, (m, n) => {
    const t = notes[n];
    // title = accessibility / copy-paste fallback; data-note drives the styled
    // tooltip, because a native title takes ~1s to appear and cannot wrap 300
    // characters of policy definition legibly.
    return t ? `<abbr class="fn" title="(${n}) ${esc(t)}" data-note="${esc(t)}">${m}</abbr>` : m;
  });
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
  return r === 0 ? '' : `<span class="sec">${tr('supp')}</span> `;
}

// ---- detail drawer ----
const AGES = [1, 20, 30, 40, 50, 60, 70, 80];
function openDrawer(pid) {
  const p = PRODUCTS.find(x => x.product_id === pid);
  CURRENT_PID = pid;
  // premium curve for the current gender selection
  const g = state.gender;
  const curve = q(
    `SELECT age, age_basis, frequency, component, section, gender, smoker, amount, age_flag FROM premiums
     WHERE product_id=? AND smoker IN (?, 'NA')
       AND gender IN (?, 'U') AND age IN (${AGES.join(',')})`,
    [pid, state.smoker ? 'Y' : 'N', g]);
  const at = (age, freq) => pickPremium(
    curve.filter(r => r.age === age && r.frequency === freq),
    { age, gender: g, smoker: state.smoker });
  const nowPrem = (() => {
    const rows = q(`SELECT gender,smoker,component,section,amount,age_flag,age,age_basis FROM premiums
      WHERE product_id=? AND age IN (?, ?) AND frequency=?`, [pid, state.age, state.age + 1, state.freq]);
    return quoteFor(rows);
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
      const dn = notesFor(schedHash(pid));
      benefitHtml = `<table class="mini benefit"><thead><tr><th>${tr('benefit')}</th>${
        cols.map(c => `<th class="num">${c}</th>`).join('')}</tr></thead><tbody>${
        [...byItem.values()].map(it => {
          const hasTier = cols.some(c => it.v[c]);
          const cells = hasTier
            ? cols.map(c => `<td class="num">${withNotes(trLimit(it.v[c]), dn) || '—'}</td>`).join('')
            : `<td class="num" colspan="${cols.length}">${withNotes(trLimit(it.v['limit']), dn) || '—'}</td>`;
          return `<tr><td>${sectionTag(it.code)}${trBenefitName(it.code, it.name)}</td>${cells}</tr>`;
        }).join('')}</tbody></table>`;
    } else {
      const dn2 = notesFor(schedHash(pid));
      benefitHtml = `<table class="mini benefit"><tbody>${benefits.map(b =>
        `<tr><td>${sectionTag(b.code)}${trBenefitName(b.code, b.name)}</td><td class="num">${withNotes(trLimit(b.raw), dn2) || '—'}</td></tr>`).join('')}</tbody></table>`;
    }
    // The five basics come first: an agent states these before opening the
    // benefit table at all.
    benefitHtml = `<h4 class="basics-h">${tr('basicsTitle')}</h4>
      <table class="mini basics"><tbody>${planBasics(pid).map(([k, v]) =>
        `<tr><td><b>${k}</b></td><td class="num">${v}</td></tr>`).join('')}</tbody></table>` + benefitHtml;
  } else {
    benefitHtml = `<p class="note">${tr('noBenefits')}</p>`;
  }

  const gTxt = state.gender === 'M' ? tr('male') : tr('female');
  const sTxt = state.smoker ? tr('smoker') : tr('nonSmoker');
  const typeLbl = p.plan_type === 'Standard' ? tr('standard') : tr('flexi');
  const planDoc = pPlanDoc(p), premDoc = pPremDoc(p);

  $('#drawerContent').innerHTML = `
    <h2 class="d-title">${pName(p)}</h2>
    <p class="d-sub">${pCompany(p)}${pLevel(p) ? ' · ' + pLevel(p) : ''} · ${p.currency}</p>
    <div class="d-badges">
      <span class="type-tag">${typeLbl}</span>${statusBadge(p)}
      ${p.tax_deductible ? `<span class="badge tax">${tr('taxFull')}</span>` : ''}
      ${p.has_smm ? '<span class="badge tax">SMM</span>' : ''}
    </div>

    <div class="d-quote">
      <span>${tr('age')} ${state.age} · ${gTxt} · ${sTxt}</span>
      <b>${quoteText(nowPrem, p.currency)}</b>
      <span>/ ${state.freq === 'annual' ? tr('year') : tr('month')}</span>
    </div>

    <div class="d-section">${tr('premiumByAge')} (${gTxt}, ${sTxt})</div>
    <table class="mini"><thead><tr><th>${tr('tblAge')}</th><th class="num">${tr('annual')}</th><th class="num">${tr('monthly')}</th></tr></thead>
      <tbody>${AGES.map(a => `<tr><td>${a}</td><td class="num">${quoteText(at(a, 'annual'), p.currency)}</td><td class="num">${quoteText(at(a, 'monthly'), p.currency)}</td></tr>`).join('')}</tbody>
    </table>
    <p class="note">${tr('premiumNote')}</p>

    <div class="d-section">${tr('benefitSchedule')}</div>
    ${benefitHtml}

    <div class="d-section">${tr('clientLink')}</div>
    <div class="clientlink">
      <p class="note">${tr('clientLinkNote')}</p>
      <div class="cl-row">
        <input id="clAgent" placeholder="${tr('yourName')}" value="${localStorage.getItem('vhis_agent') || ''}" />
        <button class="btn primary" id="clCopy">${tr('copyLink')}</button>
      </div>
      <code class="cl-url" id="clUrl"></code>
    </div>

    <div class="d-section">${tr('officialDocs')}</div>
    <div class="doclinks">
      ${planDoc ? `<a href="${planDoc}" target="_blank" rel="noopener">${tr('planDoc')} ↗</a>` : ''}
      ${premDoc ? `<a href="${premDoc}" target="_blank" rel="noopener">${tr('premiumDoc')} ↗</a>` : ''}
    </div>
    <p class="note">${tr('certified')} ${p.plan_date_en || ''}${p.earliest_plan_date_en ? ' · ' + tr('earliest') + ' ' + p.earliest_plan_date_en : ''} · ID ${p.product_id}</p>`;

  // client share link: the plan travels in the URL, so there is no client
  // record to store and no personal data held by this app.
  const mkUrl = () => {
    const who = ($('#clAgent').value || '').trim();
    const base = location.href.replace(/[^/]*$/, '') + 'advisor.html';
    return `${base}?p=${encodeURIComponent(pid)}${who ? '&a=' + encodeURIComponent(who) : ''}`;
  };
  const paint = () => { $('#clUrl').textContent = mkUrl(); };
  paint();
  $('#clAgent').addEventListener('input', e => {
    localStorage.setItem('vhis_agent', e.target.value); paint();
  });
  $('#clCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(mkUrl()); $('#clCopy').textContent = tr('copied'); }
    catch (e) { $('#clUrl').focus(); }
    setTimeout(() => $('#clCopy').textContent = tr('copyLink'), 1800);
  });

  $('#drawer').hidden = false; $('#drawerBackdrop').hidden = false;
}
function closeDrawer() { $('#drawer').hidden = true; $('#drawerBackdrop').hidden = true; }

// ---- coverage gap (agent-facing, indicative) ----
// The model, and every judgement it makes, lives in gap-model.js — which is pure
// and covered by gap-model.test.js. This file only feeds it: rows out of SQLite,
// the product record, and the procedure matcher.
let BENCH = null;   // published private-hospital cost benchmarks
let SOSP_ROWS = null;

/** Every benefit row for a product, in document order. */
function benefitRowsRaw(pid) {
  // ORDER BY is load-bearing, not tidiness: six AIA schedules publish separate
  // Network and Non-network rows for the same code. Without an explicit order,
  // which one gets picked is up to the query plan — and the browser (sql.js,
  // against a table rebuilt with no index) need not match what you see locally.
  return q(`SELECT bi.code, bi.column, bi.amount, bi.unit, bi.max_days,
                   bi.coinsurance_percent, bi.complex, bi.major, bi.intermediate,
                   bi.minor, bi.raw
            FROM benefit_items bi JOIN product_benefit pb USING(schedule_hash)
            WHERE pb.product_id=? ORDER BY bi.rowid`, [pid]);
}

/** Benefit rows keyed by item code, for the client's chosen provider tier. */
function benefitRowsFor(pid) {
  return pickTierRows(benefitRowsRaw(pid), state.tier);
}

/** Does any plan being compared actually offer a network choice? */
function anyTierChoice(pids) {
  return [...pids].some(pid => hasTierChoice(benefitRowsRaw(pid)));
}
/** The benefit_schedules row behind a product. */
function scheduleFor(pid) {
  return q(`SELECT annual_benefit_limit, deductible FROM benefit_schedules
            WHERE schedule_hash=(SELECT schedule_hash FROM product_benefit WHERE product_id=?)`,
           [pid])[0] || {};
}

/** Gap for one plan at the low / median / high hospital. See gap-model.js. */
function gapFor(pid, bench) {
  if (!BENCH || !bench) return null;
  const p = PRODUCTS.find(x => x.product_id === pid) || {};
  return gapEstimate(bench, benefitRowsFor(pid), {
    currency: p.currency, planLevel: p.plan_level_en,
    schedule: scheduleFor(pid), match: matchProcedures,
  });
}

// ---- compare ----
function premiumFor(pid, age, freq) {
  const rows = q(`SELECT gender,smoker,component,section,amount,age_flag,age,age_basis FROM premiums
    WHERE product_id=? AND age IN (?, ?) AND frequency=?`, [pid, age, age + 1, freq]);
  return pickPremium(rows, { age, gender: state.gender, smoker: state.smoker });
}
function benefitsFor(pid) {
  const rows = q(`SELECT bi.code, bi.name, bi.raw FROM benefit_items bi
    JOIN product_benefit pb USING(schedule_hash) WHERE pb.product_id=? ORDER BY bi.code`, [pid]);
  const m = {}; rows.forEach(r => { if (!m[r.code]) m[r.code] = r; }); return m;
}
const CMP_AGES = [30, 50, 65];
const CMP_BENEFITS = [['a', 'bRoom'], ['b', 'bMisc'], ['e', 'bIcu'],
                      ['f', 'bSurgeon'], ['i', 'bImaging'], ['j', 'bCancer']];
// The five items the gap model apportions a surgical bill across.
const GAP_ITEM_LABEL = { f: 'bSurgeon', g: 'bAnaes', h: 'bTheatre', a: 'bRoom', b: 'bMisc' };

function compareRows() {
  const plans = [...state.compare].map(id => PRODUCTS.find(p => p.product_id === id)).filter(Boolean);
  const ben = plans.map(p => benefitsFor(p.product_id));
  const gShort = state.gender === 'M' ? tr('male') : tr('female');
  const R = [];
  R.push([tr('rowInsurer'), plans.map(p => pCompany(p))]);
  R.push([tr('rowLevel'), plans.map(p => pLevel(p) || '—')]);
  R.push([tr('rowType'), plans.map(p => p.plan_type === 'Standard' ? tr('standard') : tr('flexi'))]);
  R.push([tr('rowCurrency'), plans.map(p => p.currency)]);
  R.push([tr('rowStatus'), plans.map(p => statusText(p)[1])]);
  R.push([tr('rowPremAnnual', state.age, gShort),
          plans.map(p => quoteText(premiumFor(p.product_id, state.age, 'annual'), p.currency)), 'big']);
  R.push([tr('rowPremMonthly', state.age),
          plans.map(p => quoteText(premiumFor(p.product_id, state.age, 'monthly'), p.currency))]);
  CMP_AGES.forEach(a => R.push([tr('rowAnnualAt', a),
    plans.map(p => quoteText(premiumFor(p.product_id, a, 'annual'), p.currency))]));
  CMP_BENEFITS.forEach(([code, key]) => {
    if (ben.some(b => b[code])) R.push([tr(key), ben.map((b, i) =>
      withNotes(trLimit(b[code] && b[code].raw), notesFor(schedHash(plans[i].product_id))) || '—')]);
  });
  R.push([tr('rowTax'), plans.map(p => p.tax_deductible ? tr('yes') : '—')]);

  // Coverage-gap block: only when the agent has picked a procedure.
  const bench = state.gapProc && BENCH
    ? BENCH.procedures.find(p => p.procedure === state.gapProc) : null;
  if (bench) {
    const gaps = plans.map(p => gapFor(p.product_id, bench));
    const money0 = v => (v == null ? '—' : money(v, 'HKD'));
    const rng = (a, b) => (a == null || b == null) ? '—'
      : (a === b ? money0(a) : `${money0(a)} – ${money0(b)}`);
    // States that must never be shown as a number: a VHIS-excluded procedure
    // pays nothing by definition, and an unknown surgical category would mean
    // guessing a cap that swings $5,000–$50,000.
    const cell = (g, pick) => !g ? '—'
      : g.excluded ? tr('gapExcluded')
      : g.noCategory ? tr('gapNoCategory')
      : rng(pick(g.lo), pick(g.hi));
    R.push([tr('gapBill'), plans.map(() => rng(bench.total_low, bench.total_high)), 'sub']);
    R.push([tr('gapPlanPays'), gaps.map(g => cell(g, x => x && x.planPays))]);
    R.push([tr('gapClientPays'), gaps.map(g => cell(g, x => x && x.clientPays)), 'gap']);
    if (gaps.some(g => g && g.ambiguous)) R.push([tr('gapCatNote'), plans.map((p, i) =>
      gaps[i] && gaps[i].ambiguous ? tr('gapCatLowest', gaps[i].category) : '—')]);
    if (gaps.some(g => g && g.fx && g.fx !== 1)) R.push([tr('gapFx'), plans.map((p, i) =>
      gaps[i] && gaps[i].fx !== 1 ? `USD × ${gaps[i].fx}` : '—')]);
    // Say which set of limits each plan is being quoted at. Without this the
    // toggle silently changes the figures and the printout does not record
    // which assumption the client was shown.
    if (anyTierChoice(state.compare)) R.push([tr('tierRow'), plans.map(p =>
      hasTierChoice(benefitRowsRaw(p.product_id))
        ? tr(state.tier === 'network' ? 'tierNetwork' : 'tierNonNetwork')
        : tr('tierSingle'))]);
    // Some plans have a benefit row we could not read a limit from. Those items
    // are assumed paid in full, which flatters the plan — say so, or a bad
    // extraction reads as generous cover.
    const unread = g => (g && g.mid && g.mid.capsNotEstablished) || null;
    if (gaps.some(unread)) R.push([tr('gapCapUnknown'), gaps.map(g => {
      const u = unread(g);
      // Chinese lists items with the enumeration comma, not a Latin one.
      const sep = LANG === 'en' ? ', ' : '、';
      return u ? tr('gapCapUnknownFor', u.map(c => tr(GAP_ITEM_LABEL[c] || 'bMisc')).join(sep)) : '—';
    })]);
  }
  return { plans, R, bench };
}

/** A procedure's name in the current language, falling back to the benchmark's
 *  own English wording if it has no translation yet. */
function procName(procedure) {
  return (tr('proc') || {})[procedure] || procedure;
}

// ---------------------------------------------------------------- plan basics
// The five facts an agent states before anything else. Annual and lifetime
// limits sit on the schedule. Ward class and deductible come from plan_basics —
// NOT from benefit_schedules.deductible, which is a per-SCHEDULE column holding
// a per-PLAN-LEVEL fact: one schedule covers eight levels priced HKD0 / 20,000 /
// 50,000 / 96,000 and stamps all of them with a single figure, so it disagreed
// with the plan's own level name on 139 products. Territorial scope came from
// the statutory Part 6 s.1(a) clause in the plan documents; the database never
// held it.
//
// "Not applicable" and "not stated" are rendered differently on purpose. A
// Standard plan has no ward class because the statute fixes room and board at
// $750/day — that is an answer, not a gap, and collapsing the two would send an
// agent hunting for a figure that does not exist.
const basicText = (trio) => {
  if (!trio) return null;
  const [v, zh, cn, detail] = trio;
  if (v === 'NOT_APPLICABLE') {
    return { na: true, txt: LANG === 'en' ? 'Not applicable' : (LANG === 'cn' ? cn : zh) };
  }
  // `detail` is the clause the short label was reduced from — a location-dependent
  // entitlement reads "半私家房（按地點而異）" in the cell and keeps the full
  // "(a) For Hong Kong, Macau … (b) elsewhere …" on hover, so the qualification is
  // never lost, only folded.
  return { txt: (LANG === 'en' ? v : (LANG === 'cn' ? cn : zh)) || v, detail: detail || '' };
};

/** The five basic facts for one plan, as [label, cell] pairs. */
function planBasics(pid) {
  const e = (BASICS && BASICS.by_product && BASICS.by_product[pid]) || {};
  const sched = q(`SELECT annual_benefit_limit a, lifetime_benefit_limit l
                   FROM benefit_schedules WHERE schedule_hash=
                     (SELECT schedule_hash FROM product_benefit WHERE product_id=?)`, [pid])[0];
  const terr = e.t != null && BASICS && BASICS.territorial
    ? BASICS.territorial[String(e.t)] : null;
  const esc = t => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const cell = (b) => !b ? `<span class="basic-none">${tr('notStated')}</span>`
    : b.na ? `<span class="basic-na">${b.txt}</span>`
    : b.detail ? `<span class="basic-more" title="${esc(b.detail)}">${b.txt}</span>` : b.txt;
  return [
    [tr('bWard'), cell(basicText(e.w))],
    [tr('bDeduct'), cell(basicText(e.d))],
    [tr('annualLimit'), (sched && trLimit(sched.a)) || `<span class="basic-none">${tr('notStated')}</span>`],
    [tr('lifetimeLimit'), (sched && trLimit(sched.l)) || `<span class="basic-none">${tr('notStated')}</span>`],
    [tr('bTerritory'), terr ? (LANG === 'en' ? terr.en : (LANG === 'cn' ? terr.cn : terr.zh))
                            : `<span class="basic-none">${tr('notStated')}</span>`],
  ];
}

/** The same five facts, side by side across the compared plans. */
function basicsTable(plans) {
  if (!BASICS) return '';
  const per = plans.map(p => planBasics(p.product_id));
  return `<h3 class="taxo-h">${tr('basicsTitle')}</h3>
    <table class="cmp-table taxo basics"><thead><tr><th></th>${plans.map(p =>
      `<th class="cmp-plan">${pName(p)}</th>`).join('')}</tr></thead><tbody>${
      per[0].map(([label], i) =>
        `<tr class="taxo-row"><th>${label}</th>${
          per.map(rows => `<td class="num">${rows[i][1]}</td>`).join('')}</tr>`).join('')
    }</tbody></table>`;
}

// ------------------------------------------------------- benefit taxonomy grid
// The statutory items are standardised by law, so every plan can be lined up on
// them. Everything above them is each insurer's own wording — 583 distinct
// titles with no shared structure. benefit_taxonomy.json maps those titles onto
// 37 canonical slots so two plans can be compared row by row instead of
// paragraph by paragraph.
//
// The section codes in the source (II-a, III-b …) look like they would do this
// job and do not: they are positional inside each insurer's own document. Half
// of them carry more than one distinct benefit, and "compassionate death
// benefit" alone appears under 24 different codes.
const taxoLabel = o => (o ? (LANG === 'en' ? o.en : LANG === 'cn' ? o.cn : o.zh) : '');
const taxoNorm = s => String(s == null ? '' : s)
  .replace(/\s*\((\d+)\)/g, '').replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

/** Which canonical slot a benefit row belongs to, or null. */
function slotFor(row) {
  if (!TAXO) return null;
  const code = String(row.code || '');
  // The statutory guard is not optional. Without it the three "Pre- and
  // post-Confinement outpatient care" keys drag 496 products' statutory item (k)
  // into SV-d, which holds 26 products of genuinely ADDITIONAL cover.
  if (new RegExp(TAXO.statutory_guard).test(code)) return 'BA-' + code[0];
  return TAXO.map[taxoNorm(row.name)] || null;
}

/** slot code -> the limit text this plan publishes for it. */
function slotValues(pid) {
  const rows = q(`SELECT bi.code, bi.name, bi.column, bi.raw
                  FROM benefit_items bi JOIN product_benefit pb USING(schedule_hash)
                  WHERE pb.product_id=? ORDER BY bi.code, bi.column`, [pid]);
  // Presence is read from ANY column: six PRUHealth schedules publish no 'limit'
  // column at all and keep their values in Network / Non-network, so filtering to
  // 'limit' would empty those plans out. Where a plan does offer both tiers the
  // agent's toggle decides which is shown.
  const chosen = pickTierRows(rows, state.tier);
  const out = {};
  for (const code in chosen) {
    const r = chosen[code];
    const slot = slotFor(r);
    if (!slot) continue;
    const txt = String(r.raw || '').trim();
    if (txt && !(out[slot] || []).includes(txt)) (out[slot] ||= []).push(txt);
  }
  // The two whole-plan ceilings are not benefit rows; they live on the schedule.
  const sch = q(`SELECT annual_benefit_limit a, lifetime_benefit_limit l
                 FROM benefit_schedules WHERE schedule_hash=
                   (SELECT schedule_hash FROM product_benefit WHERE product_id=?)`, [pid])[0];
  if (sch) {
    if (sch.a) out['SP-f'] = [String(sch.a)];
    if (sch.l) out['SP-g'] = [String(sch.l)];
  }
  return out;
}

/** The fixed 12 + 37 grid: every plan on every slot, offered or not. */
function taxonomyTable(plans) {
  if (!TAXO) return '';
  const vals = plans.map(p => slotValues(p.product_id));
  const rows = [];
  for (const g of TAXO.groups) {
    const slots = TAXO.slots.filter(s => s.g === g.c);
    // A group every compared plan is silent on says nothing; drop it rather than
    // print a block of dashes.
    if (!slots.some(s => vals.some(v => v[s.c]))) continue;
    rows.push(`<tr class="taxo-group"><th colspan="${plans.length + 1}">${taxoLabel(g)}</th></tr>`);
    slots.forEach(s => {
      const cells = vals.map(v => {
        const got = v[s.c];
        if (!got) return `<td class="num taxo-none">—</td>`;
        return `<td class="num">${got.map(t => trLimit(t)).join('<br />')}</td>`;
      }).join('');
      const off = vals.every(v => !v[s.c]) ? ' taxo-empty' : '';
      rows.push(`<tr class="taxo-row${off}"><th>${taxoLabel(s)}</th>${cells}</tr>`);
    });
  }
  if (!rows.length) return '';
  return `<h3 class="taxo-h">${tr('taxoTitle')}</h3>
    <table class="cmp-table taxo"><thead><tr><th></th>${plans.map(p =>
      `<th class="cmp-plan">${pName(p)}</th>`).join('')}</tr></thead>
      <tbody>${rows.join('')}</tbody></table>
    <p class="note">${tr('taxoNote')}</p>`;
}

function renderGapPicker() {
  const el = $('#gapPick');
  if (!el || !BENCH) return;
  // Rebuilt on every call, not just the first: the options carry translated
  // procedure names, so building them once left the list in whichever language
  // the agent happened to open the comparison in.
  const keep = state.gapProc || '';
  while (el.options.length > 1) el.remove(1);
  BENCH.procedures.slice()
    // sort on the DISPLAYED name, or the Chinese lists come out in English order
    .sort((a, b) => procName(a.procedure).localeCompare(procName(b.procedure), tr('htmlLang')))
    .forEach(p => {
      const o = document.createElement('option');
      o.value = p.procedure;               // value stays English — it keys the benchmark
      o.textContent = procName(p.procedure) + tr('hospCount', p.hospitals);
      el.appendChild(o);
    });
  el.value = keep;
}

function openCompare() {
  if (!state.compare.size) return;
  const { plans, R, bench } = compareRows();
  const gTxt = state.gender === 'M' ? tr('male') : tr('female');
  const sTxt = state.smoker ? tr('smoker') : tr('nonSmoker');
  $('#cmpTitle').textContent = tr('cmpTitle', state.age, gTxt, sTxt);
  $('#cmpBody').innerHTML = `
    <div class="print-head"><h2>${tr('comparison')}</h2>
      <p>${tr('age')} ${state.age} · ${gTxt} · ${sTxt} · ${state.currency}</p>
      ${bench ? `<p>${tr('gapFor')} ${procName(bench.procedure)}</p>` : ''}</div>
    <table class="cmp-table"><thead><tr><th></th>${plans.map(p =>
      `<th class="cmp-plan">${pName(p)}<small>${pAlt(p) || ''}</small></th>`).join('')}</tr></thead>
      <tbody>${R.map(([label, vals, cls]) =>
        `<tr class="${cls === 'gap' ? 'gaprow' : cls === 'sub' ? 'subrow' : ''}"><th>${label}</th>${
          vals.map(v => `<td class="${cls === 'big' ? 'big' : cls === 'gap' ? 'gapcell' : 'num'}">${v}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
    ${bench ? `<p class="note gapnote">${tr('gapNote', bench.hospitals)}</p>` : ''}
    ${basicsTable(plans)}
    ${taxonomyTable(plans)}`;
  renderGapPicker();
  // The toggle is meaningless for the 573 plans that publish one set of limits,
  // so it only appears when a plan on screen actually offers the choice.
  const tw = $('#tierWrap');
  if (tw) tw.hidden = !anyTierChoice(state.compare);
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
  return [[tr('quoteTitle')], [tr('age'), state.age],
          [tr('rowInsurer') === 'Insurer' ? 'Gender' : '性別', state.gender === 'M' ? tr('male') : tr('female')],
          [tr('smoker'), state.smoker ? tr('yes') : '—'],
          [state.freq === 'annual' ? tr('annual') : tr('monthly'), ''],
          [tr('rowCurrency'), state.currency],
          [tr('csvGenerated'), new Date().toLocaleString()],
          [tr('csvNote'), tr('footDisc')], []];
}
function exportResultsCsv() {
  const rows = clientHeader();
  rows.push([tr('thInsurer'), tr('thPlan'), 'EN', tr('thLevel'), tr('thType'), tr('rowCurrency'),
             `${tr('thPremium')} (${state.freq === 'annual' ? tr('annual') : tr('monthly')})`,
             tr('thStatus'), tr('rowTax'), tr('planDoc')]);
  LAST_RESULTS.forEach(r => rows.push([pCompany(r), pName(r), r.plan_name_en, pLevel(r),
    r.plan_type, r.currency, r.premium == null ? '' : Math.round(r.premium), statusText(r)[1],
    r.tax_deductible ? tr('yes') : '', pPlanDoc(r)]));
  csvDownload(`vhis-quote-age${state.age}-${state.gender}.csv`, rows);
}
function exportCompareCsv() {
  const { plans, R, bench } = compareRows();
  const rows = clientHeader();
  // Name the procedure, or the gap figures below are numbers without a question.
  if (bench) rows.push([tr('gapFor'), procName(bench.procedure)]);
  rows.push(['', ...plans.map(p => pName(p))]);
  R.forEach(([label, vals]) => rows.push([label, ...vals]));
  csvDownload(`vhis-comparison-age${state.age}.csv`, rows);
}

// ---- language ----
// Re-label the static chrome. Everything data-driven re-renders via render().
function applyLang() {
  document.documentElement.lang = tr('htmlLang');
  const set = (sel, txt) => { const e = $(sel); if (e) e.textContent = txt; };
  document.title = tr('title') + ' — VHIS';
  set('.brand h1', tr('title'));
  set('.tagline', tr('tagline'));
  set('.control-group.client h2', tr('client'));
  set('.control-group.filters h2', tr('filter'));
  const ageLbl = $('#age').parentElement;
  ageLbl.childNodes[0].nodeValue = tr('age') + ' ';
  const segTxt = (id, vals) => $('#' + id).querySelectorAll('button')
    .forEach((b, i) => b.textContent = vals[i]);
  segTxt('gender', [tr('male'), tr('female')]);
  segTxt('freq', [tr('annual'), tr('monthly')]);
  segTxt('ptype', [tr('all'), tr('standard'), tr('flexi')]);
  $('#smoker').parentElement.lastChild.nodeValue = ' ' + tr('smoker');
  $('#openOnly').parentElement.lastChild.nodeValue = ' ' + tr('sellableOnly');
  $('#smmOnly').parentElement.lastChild.nodeValue = ' ' + tr('withSmm');
  $('#search').placeholder = tr('searchPh');
  $('#insurer').options[0].textContent = tr('allInsurers');
  set('.hint', tr('hint'));
  set('#exportCsv', tr('exportCsv')); set('#printQuote', tr('printPdf'));
  set('#cmpOpen', tr('compare')); set('#cmpClear', tr('clear'));
  set('#cmpCsv', tr('exportCsv')); set('#cmpPrint', tr('printPdf')); set('#cmpClose', tr('close'));
  set('#gapLbl', tr('gapFor'));
  set('#tierLbl', tr('tierLbl'));
  segTxt('tier', [tr('tierNonNetworkBtn'), tr('tierNetworkBtn')]);
  const th = document.querySelectorAll('#resultsTable thead th');
  const heads = [null, tr('thInsurer'), tr('thPlan'), tr('thLevel'), tr('thType'),
                 tr('thPremium'), tr('thStatus'), null];
  heads.forEach((h, i) => { if (h && th[i]) th[i].textContent = h; });
  markSortHeader();
  const foot = document.querySelectorAll('.foot span');
  if (foot[0]) foot[0].textContent = tr('footSource');
  if (foot[2]) foot[2].textContent = tr('footDisc');
  // insurer dropdown labels follow the language
  const sel = $('#insurer'), keep = sel.value;
  [...sel.options].slice(1).forEach(o => { const p = PRODUCTS.find(x => x.company_en === o.value); if (p) o.textContent = pCompany(p); });
  sel.value = keep;
  renderGapPicker();          // its options are translated, so they must rebuild too
  document.querySelectorAll('.lang button').forEach(b =>
    b.classList.toggle('on', b.dataset.l === LANG));
  document.querySelectorAll('[data-k]').forEach(e => e.textContent = tr(e.dataset.k));
}
function markSortHeader() {
  document.querySelectorAll('th[data-sort]').forEach(x => {
    x.textContent = x.textContent.replace(/ [▲▼]/, '');
    if (x.dataset.sort === state.sortKey) x.textContent += state.sortDir === 1 ? ' ▲' : ' ▼';
  });
}
function setLang(l) {
  if (!LANGS.includes(l) || l === LANG) return;
  LANG = l;
  try { localStorage.setItem('vhis_lang', l); } catch (e) { /* private mode */ }
  applyLang();
  render();
  if (!$('#drawer').hidden && CURRENT_PID) openDrawer(CURRENT_PID);
  if (!$('#cmpOverlay').hidden) openCompare();
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
  $('#gapPick').addEventListener('change', e => { state.gapProc = e.target.value; openCompare(); });
  // its own wiring rather than seg(): this one re-runs the comparison, not the
  // results table, because the tier only changes what the gap estimate reads.
  $('#tier').querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    const el = $('#tier');
    el.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on'); el.dataset.value = b.dataset.v; state.tier = b.dataset.v;
    openCompare();
  }));
  $('#cmpCsv').addEventListener('click', exportCompareCsv);
  $('#cmpPrint').addEventListener('click', () => window.print());
  $('#exportCsv').addEventListener('click', exportResultsCsv);
  $('#printQuote').addEventListener('click', () => window.print());
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { closeDrawer(); $('#cmpOverlay').hidden = true; }
  });
  document.querySelectorAll('th[data-sort]').forEach(th => th.addEventListener('click', () => {
    const k = th.dataset.sort;
    state.sortDir = (state.sortKey === k) ? -state.sortDir : 1;
    state.sortKey = k;
    markSortHeader();
    render();
  }));
  document.querySelectorAll('.lang button').forEach(b =>
    b.addEventListener('click', () => setLang(b.dataset.l)));
}

// ---------------------------------------------------------------- boot status
// Stage text for the overlay in index.html. The overlay is up before this file
// runs, so it can only ever be filled in — never created — here.
const BOOT_TEXT = {
  engine: ['Starting the query engine…', '正在啟動查詢引擎…', '正在启动查询引擎…'],
  data:   ['Downloading plan data',       '正在下載計劃資料',   '正在下载计划资料'],
  index:  ['Preparing 579 plans…',        '正在整理 579 項計劃…', '正在整理 579 项计划…'],
  slow:   ['Still working. The first visit downloads about 4 MB; it is cached afterwards.',
           '仍在處理。首次瀏覽需下載約 4 MB，之後會使用快取。',
           '仍在处理。首次浏览需下载约 4 MB，之后会使用缓存。'],
  cdn:    ['Could not load the query engine from the CDN (cdn.jsdelivr.net). Check the network or any blocker, then reload.',
           '無法從 CDN（cdn.jsdelivr.net）載入查詢引擎。請檢查網絡或攔截器，然後重新載入。',
           '无法从 CDN（cdn.jsdelivr.net）加载查询引擎。请检查网络或拦截器，然后重新加载。'],
  fail:   ['Could not load the plan data.', '無法載入計劃資料。', '无法载入计划资料。'],
  old:    ['This browser cannot decompress the data file. Please use a current version of Chrome, Edge, Safari or Firefox.',
           '此瀏覽器無法解壓資料檔案。請使用最新版本的 Chrome、Edge、Safari 或 Firefox。',
           '此浏览器无法解压数据文件。请使用最新版本的 Chrome、Edge、Safari 或 Firefox。'],
};
const bootI = () => (LANG === 'hk' ? 1 : LANG === 'cn' ? 2 : 0);
const bootTr = k => BOOT_TEXT[k][bootI()];

function boot(stage, frac) {
  const s = document.getElementById('bootStage'), f = document.getElementById('bootFill');
  if (!s) return;
  s.textContent = bootTr(stage) + (frac != null ? `  ${Math.round(frac * 100)}%` : '');
  if (f) f.style.width = (frac != null ? Math.round(frac * 100) : stage === 'index' ? 100 : 6) + '%';
}

function bootFail(headline, detail) {
  const el = document.getElementById('boot');
  if (!el) return;
  el.innerHTML = `<p class="boot-err">${headline}${detail ? `<br /><code>${detail}</code>` : ''}</p>`;
}

// Say something if it is taking a while, so a slow connection reads as slow
// rather than broken.
const bootSlow = setTimeout(() => {
  const h = document.getElementById('bootHint');
  if (h) { h.textContent = bootTr('slow'); h.hidden = false; }
}, 8000);

// Every script tag carries ?v=N, but the DATA assets were fetched bare. A
// browser that had visited before a data rebuild went on serving the old
// database, taxonomy and plan basics from cache while the versioned JS updated
// around it — the app looked current and quietly was not. Caught by comparing a
// live page against the file on the server: byte-identical on disk, 25 products
// different in the browser. Reuse the version already stamped on this script.
const ASSET_V = (() => {
  const el = document.querySelector('script[src*="app.js"]');
  const m = el && /[?&]v=([^&"]+)/.exec(el.getAttribute('src') || '');
  return m ? m[1] : '';
})();
const vurl = (u) => (ASSET_V ? `${u}${u.includes('?') ? '&' : '?'}v=${ASSET_V}` : u);

// ------------------------------------------------------------------ data load
// "SQLite format 3\0" — the first 16 bytes of any SQLite file.
const SQLITE_MAGIC = [0x53, 0x51, 0x4c, 0x69, 0x74, 0x65, 0x20, 0x66,
                      0x6f, 0x72, 0x6d, 0x61, 0x74, 0x20, 0x33, 0x00];

function assertSqlite(buf, url) {
  const head = new Uint8Array(buf, 0, Math.min(16, buf.byteLength));
  const ok = head.length === 16 && SQLITE_MAGIC.every((b, i) => head[i] === b);
  if (!ok) {
    // Previously a 404 HTML page was handed straight to sql.js, which hung
    // instead of reporting anything. Fail loudly with what actually arrived.
    const first = new TextDecoder().decode(head).replace(/[^\x20-\x7e]/g, '.');
    throw new Error(`${url} is not a SQLite database (starts with "${first}")`);
  }
  return buf;
}

// Stream a response so download progress is real rather than a guess.
async function fetchProgress(url, onFrac) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  const total = +(r.headers.get('content-length') || 0);
  if (!total || !r.body || typeof ReadableStream !== 'function') return r;
  let seen = 0;
  const body = new ReadableStream({
    start(c) {
      const rd = r.body.getReader();
      (function pump() {
        rd.read().then(({ done, value }) => {
          if (done) { c.close(); return; }
          seen += value.byteLength;
          onFrac(Math.min(seen / total, 1));
          c.enqueue(value);
          pump();
        }, err => c.error(err));
      })();
    },
  });
  return new Response(body, { headers: r.headers });
}

async function inflate(url, onFrac) {
  if (typeof DecompressionStream !== 'function') throw new Error(bootTr('old'));
  const r = await fetchProgress(vurl(url), onFrac || (() => {}));
  return new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
}

// The two environments each publish exactly one variant: `build_site.py` ships
// only the gzipped copy (3.4 MB against 24 MB, on every deploy), while the dev
// tree holds only the plain file. So both paths are live — the bug was never a
// missing fallback, it was that a failure was swallowed: a 404 HTML body went
// straight into sql.js, which hung with nothing on screen and nothing logged.
// Try each in turn, and let `check` reject anything that is not what we asked
// for before it reaches the parser.
async function loadEither(gzUrl, plainUrl, check, onFrac) {
  const tried = [];
  try {
    return check(await inflate(gzUrl, onFrac), gzUrl);
  } catch (e) { tried.push(`${gzUrl}: ${e.message}`); }
  try {
    const r = await fetch(vurl(plainUrl));
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return check(await r.arrayBuffer(), plainUrl);
  } catch (e) { tried.push(`${plainUrl}: ${e.message}`); }
  throw new Error(tried.join(' · '));
}

const asJsonBytes = (buf, url) => {
  const txt = new TextDecoder().decode(buf).trimStart();
  if (!txt.startsWith('{') && !txt.startsWith('[')) {
    throw new Error(`${url} is not JSON (starts with "${txt.slice(0, 24).replace(/\s+/g, ' ')}")`);
  }
  return buf;
};

const loadGz = (gzUrl, plainUrl) => loadEither(gzUrl, plainUrl, asJsonBytes);
const loadDb = () => loadEither('vhis_app.db.gz', 'vhis_app.db', assertSqlite,
                                f => boot('data', f));

async function main() {
  boot('engine');
  // The engine comes from a CDN. If that request never lands, `initSqlJs` is
  // simply not defined and the old code threw an opaque ReferenceError.
  if (typeof initSqlJs !== 'function') throw new Error(bootTr('cdn'));
  const SQL = await initSqlJs({ locateFile: f => `https://cdn.jsdelivr.net/npm/sql.js@1.10.3/dist/${f}` });
  boot('data', 0);
  db = new SQL.Database(new Uint8Array(await loadDb()));
  boot('index');
  PRODUCTS = q(`SELECT * FROM products`);
  // Cost benchmarks + the Government surgical schedule power the coverage-gap
  // estimate. Both are small and optional — the app works without them.
  try {
    BENCH = JSON.parse(new TextDecoder().decode(await loadGz('cost_benchmarks.json.gz', 'cost_benchmarks.json')));
    SOSP_ROWS = JSON.parse(new TextDecoder().decode(await loadGz('surgical_schedule.json.gz', 'surgical_schedule.json')));
    setSurgicalSchedule(SOSP_ROWS);
    TAXO = JSON.parse(new TextDecoder().decode(
      await loadGz('benefit_taxonomy.json.gz', 'benefit_taxonomy.json')));
    BASICS = JSON.parse(new TextDecoder().decode(
      await loadGz('plan_basics.json.gz', 'plan_basics.json')));
  } catch (e) { console.warn('coverage-gap data unavailable', e); }
  // flags are stored as TEXT "0"/"1" (both truthy in JS) — coerce to numbers
  PRODUCTS.forEach(p => { p.has_smm = +p.has_smm; p.tax_deductible = +p.tax_deductible; p.de_registered = +p.de_registered; });

  // header stats (insurer <option> values stay English = stable keys)
  const open = PRODUCTS.filter(p => p.status === 'Open').length;
  const insurers = [...new Set(PRODUCTS.map(p => p.company_en))].sort();
  $('#headerStats').innerHTML =
    `<span class="pill">${open} <span data-k="sellablePlans"></span></span>` +
    `<span class="pill">${insurers.length} <span data-k="insurers"></span></span>` +
    `<span class="pill">${PRODUCTS.length} <span data-k="products"></span></span>`;
  const sel = $('#insurer');
  insurers.forEach(c => { const o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o); });
  $('#dataMeta').textContent = '';

  wire();
  applyLang();
  render();
  clearTimeout(bootSlow);
  const l = document.getElementById('boot'); if (l) l.remove();
}

// The overlay is static markup in index.html, so there is nothing to create
// here — only to finish or to fail.
main().catch(e => {
  clearTimeout(bootSlow);
  // Messages already written for a human (old browser, blocked CDN) stand on
  // their own; anything else gets the generic headline plus the raw detail.
  const own = e.message === bootTr('old') || e.message === bootTr('cdn');
  bootFail(own ? e.message : bootTr('fail'), own ? '' : e.message);
  console.error(e);
});

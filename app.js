'use strict';
/* VHIS Plan Finder — client-side agent tool. Loads the slim SQLite DB via
   sql.js and answers premium/coverage queries entirely in the browser. */

let db = null;
let PRODUCTS = [];        // all products (rows)
let LAST_RESULTS = [];    // current sorted result set (for export)
let CURRENT_PID = null;   // product shown in the drawer (re-rendered on language switch)
const state = {
  age: 35, gender: 'M', freq: 'annual', currency: 'HKD', smoker: false,
  search: '', insurer: '', ptype: '', openOnly: true, smmOnly: false,
  sortKey: 'premium', sortDir: 1,
  compare: new Set(),     // product_ids selected for side-by-side
  gapProc: '',            // benchmark procedure for the coverage-gap estimate
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
      // search every language so a Chinese query finds an English-named plan too
      const hay = [p.plan_name_en, p.plan_name_zh_hk, p.plan_name_zh_cn, p.company_en,
                   p.company_zh_hk, p.company_zh_cn, p.plan_level_en, p.plan_level_zh_hk,
                   p.plan_level_zh_cn].join(' ').toLowerCase();
      if (!hay.includes(s)) continue;
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
      <td class="num premium">${r.premium == null ? '—' : money(r.premium, r.currency)}${r.premium != null ? '<small>' + (state.freq === 'annual' ? tr('perYr') : tr('perMo')) + '</small>' : ''}</td>
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
      benefitHtml = `<table class="mini benefit"><thead><tr><th>${tr('benefit')}</th>${
        cols.map(c => `<th class="num">${c}</th>`).join('')}</tr></thead><tbody>${
        [...byItem.values()].map(it => {
          const hasTier = cols.some(c => it.v[c]);
          const cells = hasTier
            ? cols.map(c => `<td class="num">${trLimit(it.v[c]) || '—'}</td>`).join('')
            : `<td class="num" colspan="${cols.length}">${trLimit(it.v['limit']) || '—'}</td>`;
          return `<tr><td>${sectionTag(it.code)}${trBenefitName(it.code, it.name)}</td>${cells}</tr>`;
        }).join('')}</tbody></table>`;
    } else {
      benefitHtml = `<table class="mini benefit"><tbody>${benefits.map(b =>
        `<tr><td>${sectionTag(b.code)}${trBenefitName(b.code, b.name)}</td><td class="num">${trLimit(b.raw) || '—'}</td></tr>`).join('')}</tbody></table>`;
    }
    const sched = q(`SELECT annual_benefit_limit, lifetime_benefit_limit FROM benefit_schedules
      WHERE schedule_hash=(SELECT schedule_hash FROM product_benefit WHERE product_id=?)`, [pid])[0];
    if (sched) benefitHtml = `<table class="mini"><tbody>
      <tr><td><b>${tr('annualLimit')}</b></td><td class="num">${trLimit(sched.annual_benefit_limit) || '—'}</td></tr>
      <tr><td><b>${tr('lifetimeLimit')}</b></td><td class="num">${trLimit(sched.lifetime_benefit_limit) || '—'}</td></tr>
      </tbody></table>` + benefitHtml;
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
      <b>${nowPrem == null ? '—' : money(nowPrem, p.currency)}</b>
      <span>/ ${state.freq === 'annual' ? tr('year') : tr('month')}</span>
    </div>

    <div class="d-section">${tr('premiumByAge')} (${gTxt}, ${sTxt})</div>
    <table class="mini"><thead><tr><th>${tr('tblAge')}</th><th class="num">${tr('annual')}</th><th class="num">${tr('monthly')}</th></tr></thead>
      <tbody>${AGES.map(a => `<tr><td>${a}</td><td class="num">${money(at(a, 'annual'), p.currency)}</td><td class="num">${money(at(a, 'monthly'), p.currency)}</td></tr>`).join('')}</tbody>
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
let BENCH = null;   // published private-hospital cost benchmarks
const USD_HKD = 7.8;  // HKD is pegged (7.75–7.85); used to compare USD plans against HKD costs
let SOSP_ROWS = null;

// Pull a leading number out of a published limit string ("$420,000 per Policy Year").
function moneyIn(s) {
  const m = /([\d][\d,]*)(?:\.\d+)?/.exec(String(s || '').replace(/[^\d,.]/g, ' '));
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

/** Benefit rows for a product, keyed by item code — the shape gap-model wants. */
function benefitRowsFor(pid) {
  const rows = q(`SELECT bi.code, bi.amount, bi.unit, bi.max_days, bi.coinsurance_percent,
                         bi.complex, bi.major, bi.intermediate, bi.minor, bi.raw
                  FROM benefit_items bi JOIN product_benefit pb USING(schedule_hash)
                  WHERE pb.product_id=?`, [pid]);
  const out = {};
  for (const r of rows) if (!out[r.code]) out[r.code] = r;   // first value column
  return out;
}
function scheduleOpts(pid) {
  const s = q(`SELECT annual_benefit_limit, deductible FROM benefit_schedules
               WHERE schedule_hash=(SELECT schedule_hash FROM product_benefit WHERE product_id=?)`,
              [pid])[0] || {};
  // The deductible is often absent from the extracted schedule but is always
  // named in the product's plan level ("HKD180,000 Deductible") in the
  // Government dataset — which is authoritative for the variant. Prefer it,
  // otherwise a deductible plan would look far more generous than it is.
  const p = PRODUCTS.find(x => x.product_id === pid) || {};
  const m = /(?:HKD|USD|\$)\s*([\d,]+)\s*Deductible/i.exec(p.plan_level_en || '');
  const fromLevel = m ? parseFloat(m[1].replace(/,/g, '')) : null;
  const deductible = (fromLevel != null && isFinite(fromLevel))
    ? (fromLevel > 0 ? fromLevel : 0)      // "HKD0 Deductible" is a real zero
    : moneyIn(s.deductible);
  return { annualLimit: moneyIn(s.annual_benefit_limit), deductible };
}

// Hospitals and the Government schedule use different words for the same
// operation ("gastroscopy" vs "Oesophagogastroduodenoscopy (OGD)"), so map the
// benchmark name onto the schedule's terminology before matching.
const BENCH_TO_SCHEDULE = {
  'gastroscopy': 'Oesophagogastroduodenoscopy OGD',
  'colposcopy': 'colposcopy vagina cervix',
  'dilation & curettage': 'dilatation and curettage',
  'fracture fixation (ORIF)': 'open reduction internal fixation fracture',
  'fracture fixation (ORIF, lower limb)': 'open reduction internal fixation femur tibia',
  'fracture fixation (ORIF, upper limb)': 'open reduction internal fixation radius humerus',
  'TURP / prostatectomy': 'transurethral resection prostate',
  'endoscopic sinus surgery': 'functional endoscopic sinus',
  'breast lump excision': 'excision of breast lump',
  'anal fistulectomy': 'anal fistulotomy fistulectomy',
};
// Procedures VHIS certified plans do not cover at all. Showing a "gap" for these
// implies the plan merely fell short, when in fact nothing is payable.
const BENCH_EXCLUDED = new Set(['caesarean section', 'vaginal delivery', 'lasik']);

/**
 * Surgical category for a benchmark procedure, via the Government schedule.
 * Returns null when it cannot be established — the caller must NOT quietly
 * assume a category, because the surgeon's-fee cap swings $5,000 to $50,000.
 */
function categoryForBenchmark(name) {
  const m = matchProcedures(BENCH_TO_SCHEDULE[name] || name, 3);
  if (!m.length) return null;
  const cats = [...new Set(m.map(x => x.category))];
  // several candidate categories => genuinely ambiguous (e.g. unilateral vs
  // bilateral hernia). Take the LOWEST, so the estimate never overstates cover.
  const order = ['minor', 'intermediate', 'major', 'complex'];
  cats.sort((a, b) => order.indexOf(a) - order.indexOf(b));
  return { category: cats[0], ambiguous: cats.length > 1, all: cats };
}

/**
 * Gap for one plan at the low / median / high hospital. Presented as a RANGE:
 * the same operation varies widely by hospital, and a single figure would be
 * false precision on what is already a model.
 */
function gapFor(pid, bench) {
  if (!BENCH || !bench) return null;
  if (BENCH_EXCLUDED.has(bench.procedure)) return { excluded: true };
  const items = benefitRowsFor(pid);
  if (!Object.keys(items).length) return null;
  const cat = categoryForBenchmark(bench.procedure);
  if (!cat) return { noCategory: true };
  const p = PRODUCTS.find(x => x.product_id === pid) || {};
  // Benchmarks are HKD. A USD plan's limits must be converted or its cover is
  // understated ~7.8x. The HK dollar is pegged, so a fixed rate is appropriate.
  const fx = p.currency === 'USD' ? USD_HKD : 1;
  const so = scheduleOpts(pid);
  // Use the hospitals' own published average length of stay; only fall back to
  // a nominal 2 days when none is published.
  const days = bench.stay_days || 2;
  const opts = { surgicalCategory: cat.category, days,
                 annualLimit: so.annualLimit != null ? so.annualLimit * fx : null,
                 deductible: so.deductible != null ? so.deductible * fx : null };
  // scale the plan's own item caps into HKD too
  const scaled = {};
  for (const k in items) {
    const r = items[k];
    scaled[k] = fx === 1 ? r : { ...r,
      amount: r.amount != null ? r.amount * fx : r.amount,
      complex: r.complex != null ? r.complex * fx : r.complex,
      major: r.major != null ? r.major * fx : r.major,
      intermediate: r.intermediate != null ? r.intermediate * fx : r.intermediate,
      minor: r.minor != null ? r.minor * fx : r.minor };
  }
  const at = (total) => estimateGap({ ...bench, total_median: total }, scaled, opts);
  const lo = at(bench.total_low), mid = at(bench.total_median), hi = at(bench.total_high);
  if (!mid) return null;
  return { lo, mid, hi, category: cat.category, ambiguous: cat.ambiguous, fx,
           days, daysPublished: bench.stay_days != null };
}

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
const CMP_BENEFITS = [['a', 'bRoom'], ['b', 'bMisc'], ['e', 'bIcu'],
                      ['f', 'bSurgeon'], ['i', 'bImaging'], ['j', 'bCancer']];

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
          plans.map(p => money(premiumFor(p.product_id, state.age, 'annual'), p.currency)), 'big']);
  R.push([tr('rowPremMonthly', state.age),
          plans.map(p => money(premiumFor(p.product_id, state.age, 'monthly'), p.currency))]);
  CMP_AGES.forEach(a => R.push([tr('rowAnnualAt', a),
    plans.map(p => money(premiumFor(p.product_id, a, 'annual'), p.currency))]));
  CMP_BENEFITS.forEach(([code, key]) => {
    if (ben.some(b => b[code])) R.push([tr(key), ben.map(b => trLimit(b[code] && b[code].raw) || '—')]);
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
  }
  return { plans, R, bench };
}

function renderGapPicker() {
  const el = $('#gapPick');
  if (!el || !BENCH) return;
  if (el.options.length <= 1) {
    BENCH.procedures.slice().sort((a, b) => a.procedure.localeCompare(b.procedure))
      .forEach(p => {
        const o = document.createElement('option');
        o.value = p.procedure;
        o.textContent = `${p.procedure} (${p.hospitals} hosp)`;
        el.appendChild(o);
      });
  }
  el.value = state.gapProc || '';
}

function openCompare() {
  if (!state.compare.size) return;
  const { plans, R, bench } = compareRows();
  const gTxt = state.gender === 'M' ? tr('male') : tr('female');
  const sTxt = state.smoker ? tr('smoker') : tr('nonSmoker');
  $('#cmpTitle').textContent = tr('cmpTitle', state.age, gTxt, sTxt);
  $('#cmpBody').innerHTML = `
    <div class="print-head"><h2>${tr('comparison')}</h2>
      <p>${tr('age')} ${state.age} · ${gTxt} · ${sTxt} · ${state.currency}</p></div>
    <table class="cmp-table"><thead><tr><th></th>${plans.map(p =>
      `<th class="cmp-plan">${pName(p)}<small>${pAlt(p) || ''}</small></th>`).join('')}</tr></thead>
      <tbody>${R.map(([label, vals, cls]) =>
        `<tr class="${cls === 'gap' ? 'gaprow' : cls === 'sub' ? 'subrow' : ''}"><th>${label}</th>${
          vals.map(v => `<td class="${cls === 'big' ? 'big' : cls === 'gap' ? 'gapcell' : 'num'}">${v}</td>`).join('')}</tr>`).join('')}
      </tbody></table>
    ${bench ? `<p class="note gapnote">${tr('gapNote', bench.hospitals)}</p>` : ''}`;
  renderGapPicker();
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
  const { plans, R } = compareRows();
  const rows = clientHeader();
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

// The database ships gzipped (22 MB → ~3.5 MB) so the hosted demo loads fast.
// Prefer the .gz and inflate in the browser; fall back to the plain .db when
// DecompressionStream is unavailable or only the raw file is present.
// Fetch a gzipped asset and inflate it in the browser, falling back to the
// plain file when DecompressionStream is unavailable.
async function loadGz(gzUrl, plainUrl) {
  if (typeof DecompressionStream === 'function') {
    try {
      const r = await fetch(gzUrl);
      if (r.ok) return await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    } catch (e) { /* fall through */ }
  }
  return (await fetch(plainUrl)).arrayBuffer();
}

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
  // Cost benchmarks + the Government surgical schedule power the coverage-gap
  // estimate. Both are small and optional — the app works without them.
  try {
    BENCH = JSON.parse(new TextDecoder().decode(await loadGz('cost_benchmarks.json.gz', 'cost_benchmarks.json')));
    SOSP_ROWS = JSON.parse(new TextDecoder().decode(await loadGz('surgical_schedule.json.gz', 'surgical_schedule.json')));
    setSurgicalSchedule(SOSP_ROWS);
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
  const l = document.querySelector('.loading'); if (l) l.remove();
}

// loading overlay + boot
document.body.insertAdjacentHTML('beforeend', '<div class="loading"><div class="spin"></div></div>');
main().catch(e => {
  document.querySelector('.loading').innerHTML = '<p style="color:var(--bad);max-width:420px;text-align:center">Failed to load data: ' + e.message + '</p>';
  console.error(e);
});

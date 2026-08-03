'use strict';
/* Which premium a NEW client can actually be quoted.
 *
 * The rate tables are faithful — 99.98% of the 169,219 amounts appear verbatim
 * in their own source PDF. Everything that went wrong went wrong HERE, between
 * a correct row and the number on screen. Two defects, in opposite directions:
 *
 *   1. "基本計劃 Basic plan" and "附加契約 Policy rider" are two ways to buy the
 *      SAME certified plan — standalone, or attached to an existing life policy.
 *      They sit in side-by-side columns of one table, for one attained age. The
 *      old code ADDED them, so 86 products were quoted at up to 2x their price.
 *      Proof they are alternatives, not components: at AXA the two differ by a
 *      flat HK$100 at every age and both genders (a standalone-policy fee); at
 *      Prudential the ratio is a flat 1/1.2.
 *
 *   2. Insurers publish separate tables by ENTRY age — the age at which the
 *      policy commenced — and mark rows that only apply on renewal with "*".
 *      The old code took whichever section was cheapest, so a 70-year-old
 *      prospect was quoted the continuation rate of someone who joined at 30:
 *      HK$26,847 against a real new-business price of HK$53,694.
 *
 * The second is the dangerous one. Over-quoting loses a sale; under-quoting is a
 * price the insurer will not honour, discovered at underwriting. So this module
 * answers one question only: what can a person of THIS age buy TODAY. Where the
 * answer is "nothing", it says so rather than reaching for a cheaper number that
 * belongs to somebody else.
 */

// "entry 0-59", "Table 1 · entry 0-64", "Benefit Level · entry 0-80"
const ENTRY_BAND = /entry\s+(\d+)\s*[-–—]\s*(\d+)/i;

/** The entry-age band a rate table applies to, or null if it states none. */
function entryBand(section) {
  const m = ENTRY_BAND.exec(String(section || ''));
  return m ? { lo: +m[1], hi: +m[2] } : null;
}

/** Is this row a price a new applicant of `age` could be issued at? */
function isNewBusiness(row, age) {
  if ((row.age_flag || '').trim() === '*') return false;   // "*只適用於續保 for renewal only"
  const b = entryBand(row.section);
  return !b || (age >= b.lo && age <= b.hi);
}

/**
 * What one rate table costs.
 * `basic` and `rider` are ALTERNATIVES — never summed. The standalone (basic)
 * price is the headline because anyone can buy it; the rider is cheaper but
 * conditional on already holding the insurer's life policy, so it is returned
 * separately for the UI to offer rather than folded into the number.
 */
function sectionPrice(rows) {
  const by = (c) => rows.find(r => r.component === c);
  const base = by('base');
  if (base) return { amount: base.amount, component: 'base', alt: null };
  const basic = by('basic'), rider = by('rider');
  if (basic) {
    return { amount: basic.amount, component: 'basic',
             alt: rider ? { amount: rider.amount, component: 'rider' } : null };
  }
  if (rider) return { amount: rider.amount, component: 'rider', alt: null };
  const min = rows.reduce((m, r) => (r.amount < m.amount ? r : m));
  return { amount: min.amount, component: min.component, alt: null };
}

/**
 * Does this row price the client's CURRENT age?
 *
 * Insurers index rate tables three ways. Most use attained age — the age the
 * client is now. 93 products use "age next birthday", where the row labelled 1
 * is the newborn's rate. Querying the client's age directly against those
 * tables is off by a year in the cheap direction, and at age 0 it finds nothing
 * at all: a newborn got no FWD vFamily quote although the table prices one.
 *
 * 79 products (Chubb, Manulife) use a third: "Age Nearest Birthday 最接近生日",
 * the age at the birthday CLOSEST to the policy date. A client of attained age
 * N sits on row N while their last birthday is the nearer one and on row N+1
 * once their next birthday is — so BOTH rows are candidates, and picking
 * between them needs a date of birth this tool never asks for. Both are
 * admitted here; `dearerNearestBirthdayYear` then collapses them.
 * (Structural confirmation that this really is a third basis and not a wording
 * variant: all 79 of those tables print a row 0 — a newborn's nearest birthday
 * is their own — where all 93 age-next-birthday tables start at 1.)
 */
function rowIsForAge(row, age) {
  if (age == null) return true;
  const basis = row.age_basis || 'attained';
  if (basis === 'next_birthday') return row.age === age + 1;
  if (basis === 'nearest_birthday') return row.age === age || row.age === age + 1;
  return row.age === age;
}

/**
 * Collapse an age-nearest-birthday table to one row per priced column.
 *
 * rowIsForAge admits both candidate years for that basis. Leaving both in would
 * let `rows.find` in sectionPrice take whichever the query happened to return
 * first — in practice the lower year — and quoting the lower year is exactly
 * the under-quoting this module exists to prevent. Where the table prints both,
 * keep the DEARER: it is the price that survives underwriting whichever side of
 * their birthday the client turns out to be on. Where it prints only one (a
 * client at the top of the table), that one stands, since it is the only price
 * the schedule offers them.
 *
 * Dearer, not simply the higher year: infant rates FALL with age, so under 7
 * the dearer of the two candidates is the younger row.
 */
function dearerNearestBirthdayYear(rows) {
  const isNearest = (r) => (r.age_basis || 'attained') === 'nearest_birthday';
  if (!rows.some(isNearest)) return rows;
  const best = new Map(), out = [];
  for (const r of rows) {
    if (!isNearest(r)) { out.push(r); continue; }
    const k = JSON.stringify([r.section, r.component, r.gender, r.smoker, r.frequency]);
    const cur = best.get(k);
    if (!cur || r.amount > cur.amount) best.set(k, r);
  }
  return out.concat([...best.values()]);
}

/**
 * The premium to quote, or a stated reason there is none.
 * @param rows  every premium row for one product at one age and frequency
 * @param opts  {age, gender:'M'|'F', smoker:boolean}
 * @returns {amount, component, section, alt} | {unavailable, reason} | null
 */
function pickPremium(rows, opts = {}) {
  const { age, gender = 'M', smoker = false } = opts;
  if (!rows || !rows.length) return null;
  // Callers hand us both candidate ages; keep the rows this client's age
  // actually indexes under each row's own basis.
  if (rows.some(r => r.age != null)) {
    const forAge = rows.filter(r => rowIsForAge(r, age));
    if (forAge.length) rows = dearerNearestBirthdayYear(forAge);
  }

  // gender, then smoker status, falling back to the unisex / not-applicable rate
  const g = rows.some(r => r.gender === gender) ? gender : 'U';
  let cand = rows.filter(r => r.gender === g);
  const want = smoker ? 'Y' : 'N';
  const smk = cand.some(r => r.smoker === want) ? want : 'NA';
  cand = cand.filter(r => r.smoker === smk || (smk === 'NA' && r.smoker === 'NA'));
  if (!cand.length) return null;

  const sellable = cand.filter(r => isNewBusiness(r, age));
  if (!sellable.length) {
    // Rows exist for this age, but every one of them is a renewal continuation
    // rate or belongs to an entry band this client has aged out of. Showing the
    // cheapest anyway is what produced the 2x under-quotes.
    return { unavailable: true, reason: 'not open to a new applicant at this age' };
  }

  const bySection = {};
  for (const r of sellable) (bySection[r.section] ||= []).push(r);

  let best = null;
  for (const sec in bySection) {
    const p = sectionPrice(bySection[sec]);
    // Different sections here are different benefit levels of the same plan;
    // the cheapest is the indicative entry point, which is what the list shows.
    if (best == null || p.amount < best.amount) best = { ...p, section: sec };
  }
  return best;
}

if (typeof module !== 'undefined') {
  module.exports = { rowIsForAge, pickPremium, sectionPrice, entryBand, isNewBusiness,
                     dearerNearestBirthdayYear };
}

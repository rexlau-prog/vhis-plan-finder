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
 * The premium to quote, or a stated reason there is none.
 * @param rows  every premium row for one product at one age and frequency
 * @param opts  {age, gender:'M'|'F', smoker:boolean}
 * @returns {amount, component, section, alt} | {unavailable, reason} | null
 */
function pickPremium(rows, opts = {}) {
  const { age, gender = 'M', smoker = false } = opts;
  if (!rows || !rows.length) return null;

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
  module.exports = { pickPremium, sectionPrice, entryBand, isNewBusiness };
}

'use strict';
/* Coverage-gap model — what a plan would actually reimburse for ONE episode.

   The earlier illustrative version credited the FULL annual miscellaneous limit
   ($14,000) to a single procedure and ignored deductibles, coinsurance and the
   annual cap. That flattered the insurer's side and understated the client's
   shortfall. This version follows the order a claim is actually assessed:

       eligible charge per item
         -> per-item cap  (per-day x days, per-year, % of surgeon's fee)
         -> coinsurance   (client keeps a share of certain items)
         -> deductible    (client pays the first tranche of the WHOLE claim)
         -> annual limit  (caps the total payable)

   Inputs are the published bill split (doctor's fee vs hospital charge) from the
   cost benchmarks, apportioned across the VHIS benefit items. Apportionment is a
   MODEL, so every result carries `assumptions` and must be labelled indicative.
*/

// How a surgical episode's bill divides across benefit items.
//
// The DOCTOR split is derived, not guessed: in Hong Kong the anaesthetist is
// conventionally billed at ~35% of the surgeon's fee — the same basis VHIS
// itself uses for the anaesthetist benefit. So of the published doctor's fee,
// surgeon = 1/1.35 and anaesthetist = 0.35/1.35.
const ANAES_PCT = 0.35;
const SPLIT = {
  doctor: { f: 1 / (1 + ANAES_PCT), g: ANAES_PCT / (1 + ANAES_PCT) },  // ≈ .741 / .259
  // The HOSPITAL split remains MODELLED — hospitals publish a single combined
  // hospital charge and do not break out theatre vs room vs sundries. Room is
  // computed from the published length of stay where available (see roomShare).
  hospital: { h: 0.30, a: 0.25, b: 0.45 },
};

const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

// Wording that means "this item has no ceiling". Insurers write the same promise
// several ways; "Full cover", "Fully covered" and "actual cost" all appear, and
// matching only the first left 27 schedules taking the unknown-cap path instead.
const UNLIMITED_RE =
  /full cover|fully covered|actual cost|no dollar limit|no itemised sublimit|unlimited/;

/** Cap one item's eligible charge by that item's published limit. */
function applyItemCap(code, charge, row, ctx) {
  if (!row) return { paid: 0, capped: true, note: 'not a covered item' };
  const raw = (row.raw || '').toLowerCase();

  // The four-tier surgical ladder (Complex / Major / Intermediate / Minor).
  // It is published on the surgeon's fee, and by eight schedules on the
  // anaesthetist and theatre rows as well. Reading it only for code 'f' meant
  // those plans' own stated caps were ignored and those items paid in full.
  const ladder = num(row[ctx.surgicalCategory]);

  // Unlimited wording — but only when the row states no number ANYWHERE. Two
  // schedules write "Full cover" on a surgeon's-fee row that also carries a real
  // ladder ($100k/$50k/$25k/$15k); returning early on the wording alone threw
  // that ladder away and overpaid the surgeon by up to $135,000.
  if (UNLIMITED_RE.test(raw) && num(row.amount) == null && ladder == null) {
    return { paid: charge, capped: false, note: 'full cover' };
  }

  let cap = ladder;
  if (cap == null) {
    if (row.unit === 'percent_of_surgeon') {
      const pct = num(row.coinsurance_percent) ?? num(row.amount) ?? 35;
      cap = ctx.surgeonPaid * (pct / 100);             // derived from surgeon paid
    } else if (row.unit === 'per_day') {
      const days = ctx.days || 0;
      const maxDays = num(row.max_days);
      const useDays = maxDays != null ? Math.min(days, maxDays) : days;
      cap = (num(row.amount) || 0) * useDays;
    } else {
      cap = num(row.amount);                            // per-year / per-visit figure
    }
  }

  // No cap could be established. This is NOT the same as "the insurer promised
  // everything" — it usually means the extractor could not read this row. Paying
  // the charge in full is the least defensible reading, because it turns a bad
  // extraction into a plan that appears to cover 100%. Keep the optimistic
  // number so the estimate stays comparable, but mark it so the caller can warn.
  if (cap == null) {
    return { paid: charge, capped: false, capUnknown: true, note: 'cap not established' };
  }

  const paid = Math.min(charge, cap);
  // Compare with a tolerance: charges.g is algebraically identical to a 35%
  // cap on charges.f, so float association noise alone (~1e-12) would otherwise
  // report a line as capped when it paid in full.
  return { paid, capped: charge - paid > 0.5,
           note: `cap ${Math.round(cap).toLocaleString()}` };
}

/**
 * @param bench  {total_median, doctor_fee_median, hospital_charge_median}
 * @param items  benefit rows for the plan, keyed by code -> row
 * @param opts   {surgicalCategory, days, deductible, annualLimit, coinsurancePct}
 */
function estimateGap(bench, items, opts = {}) {
  const total = num(bench.total_median);
  if (!total) return null;
  let doctor = num(bench.doctor_fee_median);
  let hospital = num(bench.hospital_charge_median);
  // If a hospital didn't break the bill down, fall back to the observed split.
  if (doctor == null || hospital == null) {
    doctor = total * 0.55; hospital = total - doctor;
  }
  // Each figure is an independent median, so the parts don't sum to the total.
  // Rescale them to the total, otherwise a plan with full cover on every item
  // still appears to leave a gap.
  const parts = doctor + hospital;
  if (parts > 0) { const k = total / parts; doctor *= k; hospital *= k; }

  const ctx = { surgicalCategory: opts.surgicalCategory || 'major',
                days: opts.days ?? 2, surgeonPaid: 0 };
  const charges = {
    f: doctor * SPLIT.doctor.f, g: doctor * SPLIT.doctor.g,
    h: hospital * SPLIT.hospital.h, a: hospital * SPLIT.hospital.a,
    b: hospital * SPLIT.hospital.b,
  };

  // surgeon first: anaesthetist and theatre are a percentage OF it
  const lines = [];
  const fRes = applyItemCap('f', charges.f, items.f, ctx);
  ctx.surgeonPaid = fRes.paid;
  lines.push({ code: 'f', charge: charges.f, ...fRes });
  for (const code of ['g', 'h', 'a', 'b']) {
    lines.push({ code, charge: charges[code], ...applyItemCap(code, charges[code], items[code], ctx) });
  }

  let payable = lines.reduce((s, l) => s + l.paid, 0);

  // coinsurance (a share the client retains on certain items)
  const coins = num(opts.coinsurancePct);
  if (coins) payable *= (1 - coins / 100);

  // deductible: the client pays the first tranche of the whole claim
  const ded = num(opts.deductible) || 0;
  payable = Math.max(0, payable - ded);

  // annual benefit limit caps everything
  const annual = num(opts.annualLimit);
  const limited = annual != null ? Math.min(payable, annual) : payable;

  // Items whose cap could not be read. Those lines are paying in full on an
  // assumption, so the total is an upper bound rather than an estimate.
  const unknown = lines.filter(l => l.capUnknown).map(l => l.code);

  return {
    typicalBill: Math.round(total),
    planPays: Math.round(limited),
    clientPays: Math.round(total - limited),
    lines: lines.map(l => ({ ...l, charge: Math.round(l.charge), paid: Math.round(l.paid) })),
    // A HKD0 deductible is a fact about the plan, not the absence of one, so it
    // must survive as 0 — `ded || null` used to erase the distinction.
    applied: { deductible: ded, coinsurancePct: coins || null, annualLimit: annual ?? null },
    ...(unknown.length ? { capsNotEstablished: unknown } : {}),
    assumptions: [
      `surgical category: ${ctx.surgicalCategory}`,
      `length of stay: ${ctx.days} day(s)`,
      `doctor's fee split surgeon:anaesthetist at ${(SPLIT.doctor.f * 100).toFixed(0)}:${(SPLIT.doctor.g * 100).toFixed(0)} (anaesthetist billed at ${ANAES_PCT * 100}% of surgeon, the VHIS basis)`,
      'hospital charge apportioned theatre:room:misc 30:25:45 — MODELLED, hospitals publish only a combined figure',
      'per-item caps, then coinsurance, then deductible, then annual limit',
      'indicative only — the insurer assesses each claim on the actual itemised bill',
    ],
  };
}

/* ------------------------------------------------------------------ *
 * Integration layer.
 *
 * These decisions used to live in app.js, wrapped around the DOM and the
 * sql.js handle, which made them untestable — and they are where the two
 * worst defects were found (a USD plan compared against HKD costs, and a
 * surgical category silently defaulting to "major"). They are pure, so
 * they belong here with the model. app.js keeps thin wrappers that supply
 * the globals.
 * ------------------------------------------------------------------ */

// The HK dollar is pegged (7.75–7.85), so a fixed rate is appropriate for
// comparing a USD-denominated plan against HKD hospital costs.
const USD_HKD = 7.8;

/**
 * Pull a money figure out of a published limit ("$420,000 per Policy Year").
 *
 * The number MUST sit next to a currency marker. Taking the first digits in the
 * string instead read "Nil (below age 76); $450,000 per Policy Year (age 76 or
 * above)" as an annual limit of 76 — which then capped that plan's payout at
 * $76 on a $120,000 bill. 23 of the 128 distinct limit strings were parsing an
 * age, a part number or an excerpt note as an amount.
 */
function moneyIn(s) {
  const t = String(s || '');
  const m = /(?:HK\$|US\$|HKD|USD|\$)\s*([\d][\d,]*)(?:\.\d+)?/.exec(t);
  if (!m) return null;
  // A document that says the figure is not stated does not supply one just
  // because some OTHER, smaller sub-limit is quoted in the same sentence.
  // "Not stated ... only the item (14) sub-limit of $2,500,000 is shown" was
  // being read as a $2,500,000 annual cap on the whole plan. Only a disclaimer
  // that precedes the amount voids it — a trailing note about something else
  // must not discard a real leading figure.
  if (/not stated|not printed|not specified|not shown|not provided/i
        .test(t.slice(0, m.index))) return null;
  const n = parseFloat(m[1].replace(/,/g, ''));
  return isFinite(n) && n > 0 ? n : null;
}

/**
 * A plan's annual limit and deductible.
 * @param schedule    benefit_schedules row {annual_benefit_limit, deductible}
 * @param planLevelEn products.plan_level_en, e.g. "Regular (HKD180,000 Deductible)"
 *
 * The deductible is often missing from the extracted schedule but is always
 * named in the plan level in the Government dataset, which is authoritative for
 * the variant. Prefer it — otherwise a deductible plan looks far more generous
 * than it is.
 */
function planLimits(schedule, planLevelEn) {
  const s = schedule || {};
  const m = /(?:HKD|USD|\$)\s*([\d,]+)\s*Deductible/i.exec(planLevelEn || '');
  const fromLevel = m ? parseFloat(m[1].replace(/,/g, '')) : null;
  const deductible = (fromLevel != null && isFinite(fromLevel))
    ? (fromLevel > 0 ? fromLevel : 0)          // "HKD0 Deductible" is a real zero
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

const CATEGORY_ORDER = ['minor', 'intermediate', 'major', 'complex'];

/**
 * Surgical category for a benchmark procedure, via the Government schedule.
 * @param match  matchProcedures(query, limit) from advisor-core — injected so
 *               this file stays dependency-free and testable.
 *
 * Returns null when it cannot be established. The caller must NOT quietly assume
 * a category: the surgeon's-fee cap swings from $5,000 to $50,000 across them.
 */
function categoryForBenchmark(name, match) {
  const m = match(BENCH_TO_SCHEDULE[name] || name, 3);
  if (!m.length) return null;
  // Drop anything that is not one of the four known categories. indexOf returns
  // -1 for an unrecognised string, which would sort it AHEAD of every real
  // category and get it picked — and row[''] is undefined, so the surgeon's fee
  // would then pay in full.
  const cats = [...new Set(m.map(x => x.category))].filter(c => CATEGORY_ORDER.includes(c));
  if (!cats.length) return null;
  // several candidate categories => genuinely ambiguous (e.g. unilateral vs
  // bilateral hernia). Take the LOWEST, so the estimate never overstates cover.
  cats.sort((a, b) => CATEGORY_ORDER.indexOf(a) - CATEGORY_ORDER.indexOf(b));
  return { category: cats[0], ambiguous: cats.length > 1, all: cats };
}

/** Convert a plan's own limits from its currency into HKD, to match the costs. */
function toHkd(items, limits, currency) {
  const fx = currency === 'USD' ? USD_HKD : 1;
  if (fx === 1) return { fx, items, limits };
  const scaled = {};
  for (const k in items) {
    const r = items[k];
    // On a percent_of_surgeon row, `amount` holds a PERCENTAGE, not money.
    // Converting it turned "35% of the surgeon's fee" into 273%, so the cap
    // could never bind and every USD plan scored more generous than its
    // identical HKD twin.
    const isPct = r.unit === 'percent_of_surgeon';
    scaled[k] = { ...r,
      amount: (r.amount != null && !isPct) ? r.amount * fx : r.amount,
      complex: r.complex != null ? r.complex * fx : r.complex,
      major: r.major != null ? r.major * fx : r.major,
      intermediate: r.intermediate != null ? r.intermediate * fx : r.intermediate,
      minor: r.minor != null ? r.minor * fx : r.minor };
  }
  return { fx, items: scaled, limits: {
    annualLimit: limits.annualLimit != null ? limits.annualLimit * fx : null,
    deductible: limits.deductible != null ? limits.deductible * fx : null } };
}

/**
 * Gap for one plan at the low / median / high hospital. Presented as a RANGE:
 * the same operation varies widely by hospital, and a single figure would be
 * false precision on what is already a model.
 *
 * The low and high runs reuse the median's doctor:hospital RATIO — only the
 * level moves. Hospitals publish a total at each of low/median/high but split it
 * out only once, and the ratio is the stabler of the two.
 *
 * @param ctx {currency, schedule, planLevel, match}
 */
function gapEstimate(bench, items, ctx = {}) {
  if (!bench) return null;
  if (BENCH_EXCLUDED.has(bench.procedure)) return { excluded: true };
  if (!items || !Object.keys(items).length) return null;
  const cat = categoryForBenchmark(bench.procedure, ctx.match);
  if (!cat) return { noCategory: true };

  const raw = planLimits(ctx.schedule, ctx.planLevel);
  const { fx, items: scaled, limits } = toHkd(items, raw, ctx.currency);
  // Use the hospitals' own published average length of stay; fall back to a
  // nominal 2 days only when none is published. `??` not `||`, so that a
  // genuine 0-day day case is not silently credited two nights while
  // daysPublished (which tests != null) reports the stay as published.
  const days = bench.stay_days ?? 2;
  const opts = { surgicalCategory: cat.category, days,
                 annualLimit: limits.annualLimit, deductible: limits.deductible };

  const at = (total) => estimateGap({ ...bench, total_median: total }, scaled, opts);
  const mid = at(bench.total_median);
  if (!mid) return null;
  return { lo: at(bench.total_low), mid, hi: at(bench.total_high),
           category: cat.category, ambiguous: cat.ambiguous, fx, days,
           daysPublished: bench.stay_days != null };
}

if (typeof module !== 'undefined') {
  module.exports = { estimateGap, gapEstimate, SPLIT, ANAES_PCT, USD_HKD, moneyIn,
                     planLimits, categoryForBenchmark, toHkd,
                     BENCH_TO_SCHEDULE, BENCH_EXCLUDED };
}

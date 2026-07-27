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

// How a typical surgical episode's bill divides across benefit items.
// Doctor's fee  -> surgeon (f) + anaesthetist (g)
// Hospital bill -> theatre (h) + room (a) + miscellaneous (b)
const SPLIT = {
  doctor: { f: 0.75, g: 0.25 },
  hospital: { h: 0.30, a: 0.25, b: 0.45 },
};

const num = v => (typeof v === 'number' && isFinite(v) ? v : null);

/** Cap one item's eligible charge by that item's published limit. */
function applyItemCap(code, charge, row, ctx) {
  if (!row) return { paid: 0, capped: true, note: 'not a covered item' };
  const raw = (row.raw || '').toLowerCase();
  // Unlimited wording — the item itself imposes no ceiling.
  if (/full cover|no dollar limit|no itemised sublimit|unlimited/.test(raw) &&
      num(row.amount) == null) {
    return { paid: charge, capped: false, note: 'full cover' };
  }
  let cap = null;
  if (code === 'f') {
    cap = num(row[ctx.surgicalCategory]);              // by surgical category
  } else if (row.unit === 'percent_of_surgeon') {
    const pct = num(row.coinsurance_percent) ?? num(row.amount) ?? 35;
    cap = ctx.surgeonPaid * (pct / 100);               // derived from surgeon paid
  } else if (row.unit === 'per_day') {
    const days = ctx.days || 0;
    const maxDays = num(row.max_days);
    const useDays = maxDays != null ? Math.min(days, maxDays) : days;
    cap = (num(row.amount) || 0) * useDays;
  } else {
    cap = num(row.amount);                              // per-year / per-visit figure
  }
  if (cap == null) return { paid: charge, capped: false, note: 'no stated cap' };
  const paid = Math.min(charge, cap);
  return { paid, capped: paid < charge, note: `cap ${Math.round(cap).toLocaleString()}` };
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

  return {
    typicalBill: Math.round(total),
    planPays: Math.round(limited),
    clientPays: Math.round(total - limited),
    lines: lines.map(l => ({ ...l, charge: Math.round(l.charge), paid: Math.round(l.paid) })),
    applied: { deductible: ded || null, coinsurancePct: coins || null, annualLimit: annual || null },
    assumptions: [
      `surgical category: ${ctx.surgicalCategory}`,
      `length of stay: ${ctx.days} day(s)`,
      "bill apportioned across benefit items (doctor 75/25 surgeon:anaesthetist; hospital 30/25/45 theatre:room:misc)",
      'per-item caps, then coinsurance, then deductible, then annual limit',
      'indicative only — the insurer assesses each claim on the actual itemised bill',
    ],
  };
}

if (typeof module !== 'undefined') module.exports = { estimateGap, SPLIT };

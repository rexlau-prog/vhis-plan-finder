'use strict';
/* Advisor retrieval core — turns a client's plain-language question into GROUNDED
   FACTS drawn from their own plan.

   Design principle: the model never supplies a number. It maps the question to
   VHIS benefit categories and explains the result; every limit, exclusion and
   clause quoted here comes from the certified plan data. That keeps answers
   exact, auditable, and traceable to a source document.

   Nothing here calls an LLM — this module is deterministic and testable. */

// VHIS core benefit items. `hint` is what the item actually pays for, used both
// for matching and to explain the mapping back to the client.
const BENEFIT_HINTS = {
  a: 'hospital room and board (daily ward charge)',
  b: 'miscellaneous hospital charges (drugs, dressings, ambulance, implants)',
  c: "attending doctor's daily visit fee while admitted",
  d: "specialist's fee during confinement",
  e: 'intensive care unit',
  f: "surgeon's fee, by surgical category",
  g: "anaesthetist's fee",
  h: 'operating theatre charges',
  i: 'prescribed diagnostic imaging (CT, MRI, PET)',
  j: 'prescribed non-surgical cancer treatment (chemo, radiotherapy, targeted, immunotherapy, hormonal)',
  k: 'pre- and post-confinement / day-case outpatient care',
  l: 'psychiatric treatment (inpatient)',
};

// Question keywords -> benefit codes. A surgical admission legitimately touches
// several items at once, which is why each rule maps to a SET.
const RULES = [
  { codes: ['f', 'g', 'h', 'a', 'b'], why: 'surgery',
    kw: ['surgery', 'surgical', 'operation', 'operate', 'excision', 'resection', 'repair',
         'replacement', 'transplant', 'bypass', 'appendix', 'appendectomy', 'hernia',
         'gallbladder', 'cataract', 'knee', 'hip', 'spine', 'disc', 'tumour', 'tumor',
         '手術', '开刀', '開刀', '切除', '置換', '置换', '疝氣', '疝气', '盲腸', '盲肠',
         '膽囊', '胆囊', '白內障', '白内障', '膝', '髖', '髋', '脊椎'] },
  { codes: ['i'], why: 'diagnostic imaging',
    kw: ['mri', 'ct scan', 'ct ', 'pet', 'scan', 'imaging', 'x-ray', 'ultrasound',
         '掃描', '扫描', '磁力共振', '電腦斷層', '电脑断层', '造影', '照肺', '超聲波', '超声波'] },
  { codes: ['j', 'i'], why: 'cancer treatment',
    kw: ['cancer', 'oncology', 'chemo', 'chemotherapy', 'radiotherapy', 'radiation',
         'targeted therapy', 'immunotherapy', 'tumour', 'malignant', 'carcinoma',
         '癌', '腫瘤', '肿瘤', '化療', '化疗', '電療', '电疗', '放射治療', '放射治疗', '標靶', '标靶', '免疫治療'] },
  { codes: ['a', 'b', 'c'], why: 'hospital admission',
    kw: ['hospital', 'admit', 'admitted', 'admission', 'inpatient', 'confinement',
         'ward', 'stay', 'bed', '住院', '入院', '病房', '留醫', '留医'] },
  { codes: ['e'], why: 'intensive care',
    kw: ['icu', 'intensive care', 'critical care', '深切治療', '深切治疗', '重症'] },
  { codes: ['d'], why: 'specialist care',
    kw: ['specialist', 'consultant', '專科', '专科'] },
  { codes: ['l'], why: 'psychiatric treatment',
    kw: ['psychiatric', 'mental health', 'depression', 'anxiety', 'bipolar',
         '精神', '抑鬱', '抑郁', '焦慮', '焦虑'] },
  { codes: ['k'], why: 'outpatient care around a procedure',
    kw: ['outpatient', 'follow-up', 'follow up', 'clinic', 'consultation before',
         '門診', '门诊', '覆診', '复诊', '跟進', '跟进'] },
  { codes: ['f', 'g', 'h', 'k'], why: 'day case procedure',
    kw: ['endoscopy', 'colonoscopy', 'gastroscopy', 'day case', 'day surgery', 'biopsy',
         '內視鏡', '内视镜', '腸鏡', '肠镜', '胃鏡', '胃镜', '日間手術', '日间手术', '活組織', '活组织'] },
];

// Things VHIS certified plans generally do NOT pay for. Surfacing these early is
// honest and prevents a false expectation — always shown with the caveat that
// the client's own policy wording governs.
const LIKELY_EXCLUSIONS = [
  { label: 'Dental treatment (except emergency treatment from an accident)', hk: '牙科治療（因意外引致的緊急治療除外）', cn: '牙科治疗（因意外引致的紧急治疗除外）',
    kw: ['dental', 'tooth', 'teeth', 'wisdom', 'braces', 'orthodontic',
         '牙', '箍牙', '齒', '齿', '智慧齒', '智齿', '蛀牙', '脫牙', '脱牙', '洗牙'] },
  { label: 'Cosmetic or beautification procedures', hk: '美容或整容程序', cn: '美容或整容程序',
    kw: ['cosmetic', 'beauty', 'aesthetic', 'botox', 'liposuction', '美容', '整容', 'medical beauty'] },
  { label: 'Vision correction (glasses, LASIK, refractive errors)', hk: '矯正視力（眼鏡、激光矯視、屈光不正）', cn: '矫正视力（眼镜、激光矫视、屈光不正）',
    kw: ['lasik', 'glasses', 'spectacle', 'myopia', 'refractive', '近視', '近视', '激光矯視'] },
  { label: 'Pregnancy, childbirth and related conditions', hk: '懷孕、分娩及相關情況', cn: '怀孕、分娩及相关情况',
    kw: ['pregnan', 'childbirth', 'maternity', 'obstetric', 'delivery of baby',
         '懷孕', '怀孕', '分娩', '生產', '生产', '產科', '产科'] },
  { label: 'Routine check-ups and screening without a diagnosed condition', hk: '無確診情況下的例行體檢及篩查', cn: '无确诊情况下的例行体检及筛查',
    kw: ['check-up', 'checkup', 'screening', 'health check', 'body check',
         '體檢', '体检', '身體檢查', '身体检查'] },
  { label: 'Infertility / assisted reproduction', hk: '不孕症／人工協助生育', cn: '不孕症／人工协助生育',
    kw: ['ivf', 'infertility', 'fertility', '不孕', '試管', '试管'] },
];

function norm(s) { return (s || '').toLowerCase(); }

/* ── Schedule of Surgical Procedures ───────────────────────────────────────
   The Government classifies every listed procedure as Complex / Major /
   Intermediate / Minor, and a plan's surgeon's-fee benefit pays by that
   category. Matching the client's words to a listed procedure therefore turns
   "how much for the surgeon?" into an exact figure from their own schedule.
   SOSP is loaded by advisor.js as [{p: procedure, c: 'C|M|I|N', s: system}]. */
let SOSP = [];
let DF = null;   // document frequency per token, for weighting distinctive words
// Generic words that appear across many procedures ("repair", "excision") must
// not carry a match on their own — that is how "hernia repair" once matched
// "Repair of cornea". Weighting by rarity fixes it.
const STOP = new Set(['the', 'and', 'or', 'of', 'with', 'for', 'to', 'a', 'an', 'my', 'i',
                      'need', 'have', 'has', 'is', 'are', 'do', 'does', 'will', 'want',
                      'surgery', 'surgical', 'operation', 'procedure', 'get', 'got',
                      'cost', 'pay', 'much', 'how', 'covered', 'cover', 'plan', 'insurance']);

function tokens(s) {
  return norm(s).replace(/[^a-z0-9一-鿿 ]/g, ' ').split(/\s+/)
    .filter(t => t.length > 2 && !STOP.has(t));
}

function setSurgicalSchedule(rows) {
  SOSP = rows || [];
  DF = new Map();
  for (const r of SOSP) {
    for (const t of new Set(tokens(r.p))) DF.set(t, (DF.get(t) || 0) + 1);
  }
}

/**
 * Candidate procedures from the Government schedule for a free-text question.
 * Returns SEVERAL candidates — surgical category drives the payout, so an
 * over-confident single guess can misstate the limit by tens of thousands.
 * The UI presents them as "closest matches, confirm with your doctor".
 */
function matchProcedures(question, limit = 3) {
  if (!SOSP.length || !DF) return [];
  const qt = [...new Set(tokens(question))];
  if (!qt.length) return [];
  const N = SOSP.length;
  const scored = [];
  for (const r of SOSP) {
    const pt = new Set(tokens(r.p));
    let score = 0, distinctive = 0;
    for (const t of qt) {
      if (!pt.has(t)) continue;
      const idf = Math.log(N / (DF.get(t) || 1));   // rare token => high weight
      score += idf;
      if (idf > 1.8) distinctive++;                 // a genuinely specific term
    }
    // require at least one distinctive term so generic verbs alone can't match
    if (!distinctive) continue;
    // prefer procedures that aren't padded with unrelated words
    scored.push({ procedure: r.p, category: (r.c || '').toLowerCase(), system: r.s,
                  score: score / Math.sqrt(pt.size || 1) });
  }
  scored.sort((a, b) => b.score - a.score);
  // drop far-weaker tail matches
  const top = scored.slice(0, limit);
  return top.filter(x => x.score >= top[0].score * 0.55);
}

/** The client's own surgeon's-fee limit for a matched surgical category. */
function surgeonLimitFor(benefits, category) {
  const f = (benefits || []).find(b => b.code === 'f');
  if (!f || !category) return null;
  const out = [];
  for (const v of f.values) {
    const amt = v[category];
    if (amt != null) out.push({ column: v.column, amount: amt });
  }
  return out.length ? out : null;
}

/** Map a free-text question to VHIS benefit codes (deterministic first pass). */
function mapToBenefits(question) {
  const q = norm(question);
  const codes = new Set(), reasons = [];
  for (const r of RULES) {
    if (r.kw.some(k => q.includes(k))) {
      r.codes.forEach(c => codes.add(c));
      reasons.push(r.why);
    }
  }
  return { codes: [...codes].sort(), reasons: [...new Set(reasons)] };
}

/** Flag categories the plan probably does not cover at all. */
function flagExclusions(question) {
  const q = norm(question);
  return LIKELY_EXCLUSIONS.filter(e => e.kw.some(k => q.includes(k)))
    .map(e => (typeof LANG !== 'undefined' && LANG !== 'en' && e[LANG]) ? e[LANG] : e.label);
}

/**
 * Assemble grounded facts for a question against one product.
 *   qFn   – query helper bound to the plan database
 *   getPolicy – (product_id) => {exclusions, pre_existing, claims, waiting_defs}
 */
function groundQuestion(question, product, qFn, getPolicy) {
  const { codes, reasons } = mapToBenefits(question);
  const exclusionFlags = flagExclusions(question);
  // If nothing matched, fall back to the core inpatient items so the client
  // still sees their headline coverage rather than an empty answer.
  const useCodes = codes.length ? codes : ['a', 'b', 'f'];

  const rows = qFn(
    `SELECT bi.code, bi.name, bi.column, bi.amount, bi.unit, bi.max_days,
            bi.coinsurance_percent, bi.complex, bi.major, bi.intermediate, bi.minor, bi.raw
       FROM benefit_items bi JOIN product_benefit pb USING(schedule_hash)
      WHERE pb.product_id=? AND bi.code IN (${useCodes.map(() => '?').join(',')})`,
    [product.product_id, ...useCodes]);

  const sched = qFn(
    `SELECT annual_benefit_limit, lifetime_benefit_limit, deductible, ward_class
       FROM benefit_schedules
      WHERE schedule_hash=(SELECT schedule_hash FROM product_benefit WHERE product_id=?)`,
    [product.product_id])[0] || {};

  const byCode = {};
  rows.forEach(r => { (byCode[r.code] ||= { code: r.code, name: r.name, hint: BENEFIT_HINTS[r.code], values: [] }).values.push(r); });

  const benefits = useCodes.map(c => byCode[c]).filter(Boolean);
  const procMatches = matchProcedures(question);
  const surgical = procMatches.length
    ? { ...procMatches[0], limits: surgeonLimitFor(benefits, procMatches[0].category),
        alternatives: procMatches.slice(1) }
    : null;

  // The deductible on benefit_schedules belongs to whichever product happened to
  // represent the shared schedule — 119 products inherit a figure that
  // contradicts their own certified document. Resolve it from the plan level,
  // which the Government dataset states per product.
  const dedText = (typeof deductibleText === 'function')
    ? deductibleText(sched, product.plan_level_en, product.currency)
    : sched.deductible;

  return {
    question,
    plan: {
      product_id: product.product_id, name: product.plan_name_en,
      insurer: product.company_en, level: product.plan_level_en,
      type: product.plan_type, currency: product.currency,
      plan_doc: product.plan_doc_url_en,
    },
    matchedReasons: reasons,
    benefits,
    surgical,
    scheduleLimits: { ...sched, deductible: dedText },
    likelyExclusions: exclusionFlags,
    policy: getPolicy(product.product_id) || {},
    matchedNothing: codes.length === 0,
  };
}

/** Compact, quotable context block for an LLM. Facts only — no interpretation. */
function factSheet(g) {
  const L = [];
  L.push(`PLAN: ${g.plan.name} — ${g.plan.insurer} (${g.plan.type} Plan, ${g.plan.level || 'n/a'}, ${g.plan.currency})`);
  if (g.scheduleLimits.annual_benefit_limit) L.push(`Annual benefit limit: ${g.scheduleLimits.annual_benefit_limit}`);
  if (g.scheduleLimits.lifetime_benefit_limit) L.push(`Lifetime benefit limit: ${g.scheduleLimits.lifetime_benefit_limit}`);
  if (g.scheduleLimits.deductible) L.push(`Deductible: ${g.scheduleLimits.deductible}`);
  L.push('', 'RELEVANT BENEFIT ITEMS (exact limits from the certified schedule):');
  g.benefits.forEach(b => {
    b.values.forEach(v => {
      const col = v.column && v.column !== 'limit' ? ` [${v.column}]` : '';
      L.push(`  (${b.code}) ${b.name}${col}: ${v.raw || '—'}`);
    });
    L.push(`        ↳ pays for: ${b.hint}`);
  });
  if (g.likelyExclusions.length) {
    L.push('', 'POSSIBLY EXCLUDED (verify against the policy wording below):');
    g.likelyExclusions.forEach(e => L.push(`  - ${e}`));
  }
  if (g.policy.pre_existing) {
    L.push('', 'PRE-EXISTING CONDITION CLAUSE (verbatim):', g.policy.pre_existing.slice(0, 1500));
  }
  if (g.policy.exclusions) {
    L.push('', 'GENERAL EXCLUSIONS (verbatim):', g.policy.exclusions.slice(0, 4000));
  }
  return L.join('\n');
}

if (typeof module !== 'undefined') {
  module.exports = { mapToBenefits, flagExclusions, groundQuestion, factSheet,
                     setSurgicalSchedule, matchProcedures, surgeonLimitFor, BENEFIT_HINTS };
}

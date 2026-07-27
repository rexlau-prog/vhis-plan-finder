'use strict';
/* Trilingual support: English / 繁體中文 / 简体中文.
   Product names, insurers and plan levels come from the Government's own
   trilingual dataset. Benefit-item names and limit phrasing use the official
   Chinese wording taken from the regulator's Chinese plan documents
   (e.g. 病房及膳食 / 全數保障 / 每保單年度), not ad-hoc translation. */

const LANGS = ['en', 'hk', 'cn'];

// Initial language: saved choice, else the browser's preference, else English.
let LANG = (() => {
  try {
    const saved = localStorage.getItem('vhis_lang');
    if (LANGS.includes(saved)) return saved;
  } catch (e) { /* private mode */ }
  const nav = (navigator.languages || [navigator.language || '']).join(',').toLowerCase();
  if (/zh-cn|zh-hans|zh-sg/.test(nav)) return 'cn';
  if (/zh-hk|zh-tw|zh-hant|zh-mo/.test(nav)) return 'hk';
  return /^zh\b/.test(nav) ? 'hk' : 'en';
})();

const T = {
  en: {
    label: 'EN', htmlLang: 'en',
    title: 'VHIS Plan Finder',
    tagline: 'Voluntary Health Insurance Scheme — agent quoting & comparison',
    sellablePlans: 'sellable plans', insurers: 'insurers', products: 'products',
    client: 'Client', filter: 'Filter',
    age: 'Age', male: 'Male', female: 'Female',
    annual: 'Annual', monthly: 'Monthly', smoker: 'Smoker',
    searchPh: 'Search plan or insurer…', allInsurers: 'All insurers',
    all: 'All', standard: 'Standard', flexi: 'Flexi',
    sellableOnly: 'Sellable only', withSmm: 'With SMM',
    plans: n => `${n} plan${n === 1 ? '' : 's'}`,
    hint: "indicative premium at the client's age · non-guaranteed · sorted low→high",
    exportCsv: 'Export CSV', printPdf: 'Print / PDF',
    thInsurer: 'Insurer', thPlan: 'Plan', thLevel: 'Level', thType: 'Type',
    thPremium: 'Premium', thStatus: 'Status', details: 'Details',
    noMatch: 'No plans match these filters.',
    stOpen: 'Open', stRenewal: 'Renewal only', stDereg: 'De-registered',
    stUnavail: 'Unavailable', tax: 'Tax✓', taxFull: 'Tax-deductible',
    perYr: '/yr', perMo: '/mo', year: 'year', month: 'month',
    nonSmoker: 'Non-smoker',
    premiumByAge: 'Premium by age', tblAge: 'Age',
    premiumNote: 'Non-guaranteed; excludes the Insurance Authority levy. Deductible/region variants may price differently — see the premium document.',
    benefitSchedule: 'Benefit schedule',
    annualLimit: 'Annual benefit limit', lifetimeLimit: 'Lifetime benefit limit',
    benefit: 'Benefit', noBenefits: 'Structured benefit schedule not yet extracted for this plan — open the plan document below for full coverage limits.',
    clientLink: 'Client link', copyLink: 'Copy link', copied: 'Copied ✓', yourName: 'Your name (shown to the client)',
    clientLinkNote: 'Send this to your client. They can ask what this plan covers in plain language; the answer quotes their schedule and points back to you. No client data is stored.',
    gapFor: 'Coverage gap for', gapBill: 'Typical bill (range across hospitals)',
    gapPlanPays: 'Plan pays (est.)', gapClientPays: 'CLIENT PAYS (est.)',
    gapNote: n => `Indicative only. Typical bill = published medians from ${n} HK private hospital(s); the range spans hospitals. Modelled as: eligible charge → per-item cap → coinsurance → deductible → annual limit, using each procedure's published average length of stay. How the hospital charge divides between theatre, room and sundries is modelled — hospitals publish only a combined figure. The insurer assesses each claim on the actual itemised bill.`,
    gapExcluded: 'not covered by VHIS', gapNoCategory: 'category unknown — see plan doc',
    gapCatNote: 'Surgical category', gapCatLowest: c => `${c} (lowest of several matches)`,
    gapFx: 'FX applied to plan limits',
    officialDocs: 'Official documents', planDoc: 'Plan document', premiumDoc: 'Premium table',
    certified: 'Certified', earliest: 'earliest',
    selected: 'selected', compare: 'Compare ⇄', clear: 'Clear', close: 'Close ✕',
    comparison: 'Plan comparison', cmpTitle: (a, g, s) => `Comparison — age ${a}, ${g}, ${s}`,
    rowInsurer: 'Insurer', rowLevel: 'Level', rowType: 'Type', rowCurrency: 'Currency',
    rowStatus: 'Status', rowPremAnnual: (a, g) => `Premium — age ${a} ${g} (annual)`,
    rowPremMonthly: a => `Premium — age ${a} (monthly)`, rowAnnualAt: a => `Annual @ age ${a}`,
    rowTax: 'Tax-deductible', yes: 'Yes',
    bRoom: 'Room & board', bMisc: 'Miscellaneous', bIcu: 'Intensive care',
    bSurgeon: "Surgeon's fee", bImaging: 'Diagnostic imaging', bCancer: 'Cancer treatment',
    supp: 'supp',
    footSource: 'Data: HK Government VHIS certified-plans open dataset (data.gov.hk) + plan-document PDFs.',
    footDisc: 'For agent reference only. Premiums are non-guaranteed and exclude the IA levy. Verify against the official documents before advising a client.',
    quoteTitle: 'VHIS quote', csvGenerated: 'Generated', csvNote: 'Note',
  },
  hk: {
    label: '繁', htmlLang: 'zh-Hant-HK',
    title: '自願醫保計劃搜尋器',
    tagline: '自願醫保計劃 — 代理報價及比較',
    sellablePlans: '個可銷售計劃', insurers: '間保險公司', products: '項產品',
    client: '客戶資料', filter: '篩選',
    age: '年齡', male: '男', female: '女',
    annual: '年繳', monthly: '月繳', smoker: '吸煙',
    searchPh: '搜尋計劃或保險公司…', allInsurers: '所有保險公司',
    all: '全部', standard: '標準計劃', flexi: '靈活計劃',
    sellableOnly: '只顯示可銷售', withSmm: '附加醫療保障',
    plans: n => `${n} 個計劃`,
    hint: '按客戶年齡計算的參考保費 · 非保證 · 由低至高排序',
    exportCsv: '匯出 CSV', printPdf: '列印 / PDF',
    thInsurer: '保險公司', thPlan: '計劃', thLevel: '級別', thType: '類型',
    thPremium: '保費', thStatus: '狀態', details: '詳情',
    noMatch: '沒有符合條件的計劃。',
    stOpen: '可投保', stRenewal: '只限續保', stDereg: '已取消註冊',
    stUnavail: '不適用', tax: '可扣稅', taxFull: '可扣稅',
    perYr: '/年', perMo: '/月', year: '年', month: '月',
    nonSmoker: '非吸煙',
    premiumByAge: '各年齡保費', tblAge: '年齡',
    premiumNote: '保費非保證，並不包括保險業監管局徵費。不同自付費／地域選項的保費或有差異 — 詳見保費表。',
    benefitSchedule: '保障表',
    annualLimit: '每年保障限額', lifetimeLimit: '終身保障限額',
    benefit: '保障項目', noBenefits: '此計劃的保障表尚未整理 — 請參閱下方的保障條款文件以了解完整賠償限額。',
    clientLink: '客戶連結', copyLink: '複製連結', copied: '已複製 ✓', yourName: '你的姓名（顯示給客戶）',
    clientLinkNote: '把此連結傳給客戶。他們可以用日常語言查詢此計劃的保障，答案會引用其保障表並指引他們聯絡你。系統不會儲存任何客戶資料。',
    gapFor: '保障缺口 —', gapBill: '一般帳單（各醫院範圍）',
    gapPlanPays: '計劃賠付（估算）', gapClientPays: '客戶自付（估算）',
    gapNote: n => `僅供參考。一般帳單取自 ${n} 間香港私家醫院公布的中位數，範圍涵蓋各醫院。計算方式：合資格費用 → 各項賠償上限 → 共同保險 → 自付費 → 每年保障限額，住院日數採用各手術已公布的平均住院日。醫院收費在手術室／病房／雜項之間的分攤屬估算 — 醫院只公布合計金額。實際賠償由保險公司按帳單逐項審核。`,
    gapExcluded: '自願醫保不保', gapNoCategory: '未能確定手術分類 — 請查閱條款',
    gapCatNote: '手術分類', gapCatLowest: c => `${c}（多項配對中最低者）`,
    gapFx: '計劃限額之匯率換算',
    officialDocs: '官方文件', planDoc: '保障條款', premiumDoc: '保費表',
    certified: '認證日期', earliest: '最早認證',
    selected: '項已選', compare: '比較 ⇄', clear: '清除', close: '關閉 ✕',
    comparison: '計劃比較', cmpTitle: (a, g, s) => `計劃比較 — ${a} 歲・${g}・${s}`,
    rowInsurer: '保險公司', rowLevel: '級別', rowType: '類型', rowCurrency: '貨幣',
    rowStatus: '狀態', rowPremAnnual: (a, g) => `保費 — ${a} 歲 ${g}（年繳）`,
    rowPremMonthly: a => `保費 — ${a} 歲（月繳）`, rowAnnualAt: a => `${a} 歲年繳保費`,
    rowTax: '可扣稅', yes: '是',
    bRoom: '病房及膳食', bMisc: '雜項開支', bIcu: '深切治療',
    bSurgeon: '外科醫生費', bImaging: '訂明診斷成像檢測', bCancer: '訂明非手術癌症治療',
    supp: '附加',
    footSource: '資料來源：香港政府自願醫保認可產品公開數據集（data.gov.hk）及保障條款文件。',
    footDisc: '僅供保險代理參考。保費非保證並不包括保監局徵費。向客戶提供建議前，請以官方文件為準。',
    quoteTitle: '自願醫保報價', csvGenerated: '產生時間', csvNote: '備註',
  },
  cn: {
    label: '简', htmlLang: 'zh-Hans-CN',
    title: '自愿医保计划搜寻器',
    tagline: '自愿医保计划 — 代理报价及比较',
    sellablePlans: '个可销售计划', insurers: '间保险公司', products: '项产品',
    client: '客户资料', filter: '筛选',
    age: '年龄', male: '男', female: '女',
    annual: '年缴', monthly: '月缴', smoker: '吸烟',
    searchPh: '搜寻计划或保险公司…', allInsurers: '所有保险公司',
    all: '全部', standard: '标准计划', flexi: '灵活计划',
    sellableOnly: '只显示可销售', withSmm: '附加医疗保障',
    plans: n => `${n} 个计划`,
    hint: '按客户年龄计算的参考保费 · 非保证 · 由低至高排序',
    exportCsv: '导出 CSV', printPdf: '打印 / PDF',
    thInsurer: '保险公司', thPlan: '计划', thLevel: '级别', thType: '类型',
    thPremium: '保费', thStatus: '状态', details: '详情',
    noMatch: '没有符合条件的计划。',
    stOpen: '可投保', stRenewal: '只限续保', stDereg: '已取消注册',
    stUnavail: '不适用', tax: '可扣税', taxFull: '可扣税',
    perYr: '/年', perMo: '/月', year: '年', month: '月',
    nonSmoker: '非吸烟',
    premiumByAge: '各年龄保费', tblAge: '年龄',
    premiumNote: '保费非保证，并不包括保险业监管局征费。不同自付费／地域选项的保费或有差异 — 详见保费表。',
    benefitSchedule: '保障表',
    annualLimit: '每年保障限额', lifetimeLimit: '终身保障限额',
    benefit: '保障项目', noBenefits: '此计划的保障表尚未整理 — 请参阅下方的保障条款文件以了解完整赔偿限额。',
    clientLink: '客户链接', copyLink: '复制链接', copied: '已复制 ✓', yourName: '你的姓名（显示给客户）',
    clientLinkNote: '把此链接传给客户。他们可以用日常语言查询此计划的保障，答案会引用其保障表并指引他们联络你。系统不会储存任何客户资料。',
    gapFor: '保障缺口 —', gapBill: '一般账单（各医院范围）',
    gapPlanPays: '计划赔付（估算）', gapClientPays: '客户自付（估算）',
    gapNote: n => `仅供参考。一般账单取自 ${n} 间香港私家医院公布的中位数，范围涵盖各医院。计算方式：合资格费用 → 各项赔偿上限 → 共同保险 → 自付费 → 每年保障限额，住院日数采用各手术已公布的平均住院日。医院收费在手术室／病房／杂项之间的分摊属估算 — 医院只公布合计金额。实际赔偿由保险公司按账单逐项审核。`,
    gapExcluded: '自愿医保不保', gapNoCategory: '未能确定手术分类 — 请查阅条款',
    gapCatNote: '手术分类', gapCatLowest: c => `${c}（多项配对中最低者）`,
    gapFx: '计划限额之汇率换算',
    officialDocs: '官方文件', planDoc: '保障条款', premiumDoc: '保费表',
    certified: '认证日期', earliest: '最早认证',
    selected: '项已选', compare: '比较 ⇄', clear: '清除', close: '关闭 ✕',
    comparison: '计划比较', cmpTitle: (a, g, s) => `计划比较 — ${a} 岁・${g}・${s}`,
    rowInsurer: '保险公司', rowLevel: '级别', rowType: '类型', rowCurrency: '货币',
    rowStatus: '状态', rowPremAnnual: (a, g) => `保费 — ${a} 岁 ${g}（年缴）`,
    rowPremMonthly: a => `保费 — ${a} 岁（月缴）`, rowAnnualAt: a => `${a} 岁年缴保费`,
    rowTax: '可扣税', yes: '是',
    bRoom: '病房及膳食', bMisc: '杂项开支', bIcu: '深切治疗',
    bSurgeon: '外科医生费', bImaging: '订明诊断成像检测', bCancer: '订明非手术癌症治疗',
    supp: '附加',
    footSource: '资料来源：香港政府自愿医保认可产品公开数据集（data.gov.hk）及保障条款文件。',
    footDisc: '仅供保险代理参考。保费非保证并不包括保监局征费。向客户提供建议前，请以官方文件为准。',
    quoteTitle: '自愿医保报价', csvGenerated: '产生时间', csvNote: '备注',
  },
};

// Official Chinese names for the VHIS core benefit items (a)-(l), taken from
// the Government's Chinese plan documents.
const BENEFIT_NAMES = {
  a: ['病房及膳食', '病房及膳食'],
  b: ['雜項開支', '杂项开支'],
  c: ['主診醫生巡房費', '主诊医生巡房费'],
  d: ['專科醫生費', '专科医生费'],
  e: ['深切治療', '深切治疗'],
  f: ['外科醫生費', '外科医生费'],
  g: ['麻醉科醫生費', '麻醉科医生费'],
  h: ['手術室費', '手术室费'],
  i: ['訂明診斷成像檢測', '订明诊断成像检测'],
  j: ['訂明非手術癌症治療', '订明非手术癌症治疗'],
  k: ['入院前或出院後／日間手術前後的門診護理', '入院前或出院后／日间手术前后的门诊护理'],
  l: ['精神科治療', '精神科治疗'],
};

// Limit-cell phrasing, mirroring the wording used in the Chinese plan documents.
const LIMIT_RULES = [
  [/\bfull\s*cover(age)?\b/gi, '全數保障', '全数保障'],
  [/\bno\s+dollar\s+limit\b/gi, '不設分項賠償限額', '不设分项赔偿限额'],
  [/\bno\s+itemised\s+sublimit\b/gi, '不設分項賠償限額', '不设分项赔偿限额'],
  [/\bunlimited\b/gi, '無限額', '无限额'],
  [/\bactual\s+cost\b/gi, '實際費用', '实际费用'],
  [/\bper\s+policy\s+year\b/gi, '每保單年度', '每保单年度'],
  [/\bper\s+day\b/gi, '每日', '每日'],
  [/\bper\s+visit\b/gi, '每次診症', '每次诊症'],
  [/\bper\s+surgery\b/gi, '每項手術', '每项手术'],
  [/\bmax(imum)?\s+(\d+)\s+days?\b/gi, '最多 $2 日', '最多 $2 日'],
  [/\bcomplex\b/gi, '複雜', '复杂'],
  [/\bmajor\b/gi, '大型', '大型'],
  [/\bintermediate\b/gi, '中型', '中型'],
  [/\bminor\b/gi, '小型', '小型'],
  [/(\d+)%\s*coinsurance/gi, '$1% 共同保險', '$1% 共同保险'],
  [/subject to/gi, '設', '设'],
  [/(\d+)%\s*of\s*surgeon'?s?\s*fee\s*payable/gi, '外科醫生費的 $1%', '外科医生费的 $1%'],
  [/\bnil\b/gi, '無', '无'],
  [/\(?\bitems?\s+\(?([a-z])\)?\s*[-–—]\s*\(?([a-z])\)?\)?/gi, '保障項目 ($1) – ($2)', '保障项目 ($1) – ($2)'],
  [/regardless of (the )?surgical categor(y|ies)/gi, '不論手術分類', '不论手术分类'],
  [/\bper\s+accident\b/gi, '每宗意外', '每宗意外'],
  [/\bper\s+incident\b/gi, '每宗事故', '每宗事故'],
  [/\beach\s+item\b/gi, '每項', '每项'],
];

function tr(key, ...args) {
  const v = (T[LANG] || T.en)[key];
  return typeof v === 'function' ? v(...args) : (v ?? (T.en[key] ?? key));
}
// Chinese states the unit BEFORE the amount ("每日 $750", "每保單年度 最多 180 日"),
// which is the reverse of the English source — reorder after substitution so the
// wording matches the regulator's Chinese schedules.
const UNITS = '每日|每保單年度|每保单年度|每次診症|每次诊症|每項手術|每项手术|每宗意外|每宗事故|每項|每项';
const REORDER = [
  [new RegExp(`(\\$?[\\d,]+(?:\\.\\d+)?)\\s*(${UNITS})`, 'g'), '$2 $1'],
  [new RegExp(`(最多\\s*\\d+\\s*日)\\s*(${UNITS})`, 'g'), '$2 $1'],
];

// Translate an English limit cell into the current language, preserving the
// numbers and footnote markers exactly as printed.
function trLimit(raw) {
  if (LANG === 'en' || !raw) return raw;
  const idx = LANG === 'hk' ? 1 : 2;
  let out = String(raw);
  for (const rule of LIMIT_RULES) out = out.replace(rule[0], rule[idx]);
  for (const [re, rep] of REORDER) out = out.replace(re, rep);
  return out.replace(/,\s+(?=\D)/g, '，').replace(/\s{2,}/g, ' ').trim();
}
function trBenefitName(code, name) {
  if (LANG === 'en') return name;
  const e = BENEFIT_NAMES[(code || '').toLowerCase()];
  return e ? e[LANG === 'hk' ? 0 : 1] : name;   // supplementary items keep source wording
}

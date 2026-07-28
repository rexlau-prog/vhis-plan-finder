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
    gapCapUnknown: 'Limit could not be read',
    gapCapUnknownFor: items => `${items} — assumed paid in full, so this plan's figure is an upper bound. Check the policy document.`,
    premClosed: 'not open at this age',
    premClosedHint: 'Every published rate for this age is a renewal-only continuation rate, or belongs to an entry-age band this client has passed. The plan cannot be issued to a new applicant of this age.',
    hospCount: n => ` (${n} hosp)`,   // punctuation included: Chinese uses full-width
    tierLbl: 'Provider', tierRow: 'Limits quoted at',
    tierNetwork: 'Network provider', tierNonNetwork: 'Own choice of doctor',
    tierSingle: 'one set of limits',
    tierNetworkBtn: 'Network', tierNonNetworkBtn: 'Own doctor',
    // Procedure names for the coverage-gap picker. The benchmark file is English
    // only (it is keyed on the hospitals' own published wording), so the
    // translations live here. English needs no map — it falls back to the key.
    proc: {},
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
    bAnaes: "Anaesthetist's fee", bTheatre: 'Operating theatre',
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
    gapCapUnknown: '未能讀取賠償上限',
    gapCapUnknownFor: items => `${items} — 已假設全數賠償，故此計劃的金額僅為上限估算。請查閱保單文件。`,
    premClosed: '此年齡不接受投保',
    premClosedHint: '此年齡的所有已公布保費均屬續保專用，或屬於客戶已超出的投保年齡組別。此計劃不能以新單形式承保此年齡的客戶。',
    hospCount: n => `（${n} 間醫院）`,
    tierLbl: '醫療網絡', tierRow: '採用哪一組限額',
    tierNetwork: '網絡內醫生', tierNonNetwork: '自選醫生（網絡外）',
    tierSingle: '只有一組限額',
    tierNetworkBtn: '網絡內', tierNonNetworkBtn: '自選醫生',
    // 手術名稱（保障缺口選單）。基準檔案只有英文（沿用醫院公布的字眼），故譯名置於此。
    proc: {
      'TURP / prostatectomy': '經尿道前列腺切除術（TURP）',
      'anal fistulectomy': '肛瘻切除術',
      'arthroscopy': '關節鏡檢查',
      'breast lump excision': '乳房腫塊切除術',
      'bronchoscopy': '支氣管鏡檢查',
      'caesarean section': '剖腹分娩',
      'carpal tunnel release': '腕管鬆解術',
      'cataract surgery': '白內障手術',
      'cholecystectomy': '膽囊切除術',
      'circumcision': '包皮環切術',
      'colectomy': '結腸切除術',
      'colonoscopy': '大腸鏡檢查',
      'colposcopy': '陰道鏡檢查',
      'cystoscopy': '膀胱鏡檢查',
      'dilation & curettage': '子宮擴刮術（D&C）',
      'endoscopic sinus surgery': '內窺鏡鼻竇手術',
      'fracture fixation (ORIF)': '骨折切開復位內固定術',
      'fracture fixation (ORIF, lower limb)': '骨折切開復位內固定術（下肢）',
      'fracture fixation (ORIF, upper limb)': '骨折切開復位內固定術（上肢）',
      'gastroscopy': '胃鏡檢查',
      'haemorrhoidectomy': '痔瘡切除術',
      'hernia repair': '疝氣修補術',
      'hysterectomy': '子宮切除術',
      'knee arthroscopy': '膝關節鏡手術',
      'laminectomy': '椎板切除術',
      'laryngoscopy': '喉鏡檢查',
      'mastectomy': '乳房切除術',
      'myomectomy': '子宮肌瘤切除術',
      'ovarian cystectomy': '卵巢囊腫切除術',
      'radical prostatectomy': '根治性前列腺切除術',
      'spinal fusion': '脊椎融合術',
      'thyroidectomy': '甲狀腺切除術',
      'tonsillectomy': '扁桃腺切除術',
      'total hip replacement': '全髖關節置換術',
      'total knee replacement': '全膝關節置換術',
      'trigger finger release': '彈弓指鬆解術',
      'vaginal delivery': '順產（陰道分娩）',
    },
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
    bAnaes: '麻醉科醫生費', bTheatre: '手術室費用',
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
    gapCapUnknown: '未能读取赔偿上限',
    gapCapUnknownFor: items => `${items} — 已假设全数赔偿，故此计划的金额仅为上限估算。请查阅保单文件。`,
    premClosed: '此年龄不接受投保',
    premClosedHint: '此年龄的所有已公布保费均属续保专用，或属于客户已超出的投保年龄组别。此计划不能以新单形式承保此年龄的客户。',
    hospCount: n => `（${n} 间医院）`,
    tierLbl: '医疗网络', tierRow: '采用哪一组限额',
    tierNetwork: '网络内医生', tierNonNetwork: '自选医生（网络外）',
    tierSingle: '只有一组限额',
    tierNetworkBtn: '网络内', tierNonNetworkBtn: '自选医生',
    // 手术名称（保障缺口选单）。基准档案只有英文（沿用医院公布的字眼），故译名置于此。
    proc: {
      'TURP / prostatectomy': '经尿道前列腺切除术（TURP）',
      'anal fistulectomy': '肛瘘切除术',
      'arthroscopy': '关节镜检查',
      'breast lump excision': '乳房肿块切除术',
      'bronchoscopy': '支气管镜检查',
      'caesarean section': '剖宫产',
      'carpal tunnel release': '腕管松解术',
      'cataract surgery': '白内障手术',
      'cholecystectomy': '胆囊切除术',
      'circumcision': '包皮环切术',
      'colectomy': '结肠切除术',
      'colonoscopy': '结肠镜检查',
      'colposcopy': '阴道镜检查',
      'cystoscopy': '膀胱镜检查',
      'dilation & curettage': '刮宫术（D&C）',
      'endoscopic sinus surgery': '内镜鼻窦手术',
      'fracture fixation (ORIF)': '骨折切开复位内固定术',
      'fracture fixation (ORIF, lower limb)': '骨折切开复位内固定术（下肢）',
      'fracture fixation (ORIF, upper limb)': '骨折切开复位内固定术（上肢）',
      'gastroscopy': '胃镜检查',
      'haemorrhoidectomy': '痔疮切除术',
      'hernia repair': '疝修补术',
      'hysterectomy': '子宫切除术',
      'knee arthroscopy': '膝关节镜手术',
      'laminectomy': '椎板切除术',
      'laryngoscopy': '喉镜检查',
      'mastectomy': '乳房切除术',
      'myomectomy': '子宫肌瘤切除术',
      'ovarian cystectomy': '卵巢囊肿切除术',
      'radical prostatectomy': '根治性前列腺切除术',
      'spinal fusion': '脊柱融合术',
      'thyroidectomy': '甲状腺切除术',
      'tonsillectomy': '扁桃体切除术',
      'total hip replacement': '全髋关节置换术',
      'total knee replacement': '全膝关节置换术',
      'trigger finger release': '扳机指松解术',
      'vaginal delivery': '顺产（阴道分娩）',
    },
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
    bAnaes: '麻醉科医生费', bTheatre: '手术室费用',
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
/* Order is load-bearing: these run in sequence, so a long phrase must be
   consumed before a shorter rule can eat part of it. "benefit limit of benefit
   item (i)" has to match before the bare "benefit item" rule, or it degrades
   into half-translated soup.

   Scope note: these translate the VHIS glossary terms and the recurring
   contractual phrasing. Insurer-specific prose that is not in the glossary is
   deliberately left in English — a confident-sounding wrong translation of a
   coverage condition is worse for an agent than an untranslated one. */
const LIMIT_RULES = [
  // ---- whole clauses (must precede every rule whose phrase they contain) ----
  [/\bCoinsurance shall be (\d+)% if the conditions stated in Section\s*([\d\w.()]+)\s*of the Supplement\s*[–—-]\s*Benefits are fully satisfied\b/gi,
   '如完全符合《附加契約 — 保障》第 $2 節所載條件，共同保險為 $1%',
   '如完全符合《附加契约 — 保障》第 $2 节所载条件，共同保险为 $1%'],
  [/\bsubject to (?:benefit\s+)?limits? of benefits?\s*\(([IVX]+)\)\s*"([^"]+)"\s*under\s+Enhanced [Bb]enefits/gi,
   '設《增強保障》項下保障 ($1)「$2」的限額', '设《增强保障》项下保障 ($1)「$2」的限额'],
  [/\bsubject to (?:benefit\s+)?limits? of benefit items?\s*\(?([a-z])\)?\s*"([^"]+)"\s*of \d\)\s*Enhanced [Bb]enefits/gi,
   '設《增強保障》項下保障項目 ($1)「$2」的限額', '设《增强保障》项下保障项目 ($1)「$2」的限额'],
  [/\bFor any Reasonable and Customary charges incurred outside of Hong Kong, Macau and mainland China which are payable under this benefit item, the Reasonable and Customary charges incurred shall be reduced to (\d+)% in the calculation of the total benefit amount payable/gi,
   '在香港、澳門及中國內地以外產生而屬本保障項目應付的合理及慣常費用，計算應付保障總額時只按 $1% 計算',
   '在香港、澳门及中国内地以外产生而属本保障项目应付的合理及惯常费用，计算应付保障总额时只按 $1% 计算'],
  [/\bsubject to surgical category for the surgery\s*\/\s*procedure in the Schedule of Surgical Procedures\b/gi,
   '按《外科手術表》所載該手術／程序的手術分類', '按《外科手术表》所载该手术／程序的手术分类'],
  [/\bPayable after exceeding the (\d+) days per Policy Year as stated under item ([IVX]+)\s*\(([a-z])\)/gi,
   '於超出項目 $2($3) 所訂每保單年度 $1 日後方可賠付',
   '于超出项目 $2($3) 所订每保单年度 $1 日后方可赔付'],
  [/\bPerformed in a setting for providing Medical Services to a Day Patient\b/gi,
   '在為日間病人提供醫療服務的處所進行', '在为日间病人提供医疗服务的处所进行'],
  [/\bthe deduction of Deductible and Benefit Contribution Amount\b/gi,
   '扣除自付費及保障分擔額', '扣除自付费及保障分担额'],
  [/\bin accordance with Section\s*([\d\w.()]+)\s*of Part\s*([\d\w.]+)\s*of the Terms and Conditions\b/gi,
   '按保單條款第 $2 部第 $1 節', '按保单条款第 $2 部第 $1 节'],
  [/\bfollow-up outpatient visits? other than dietitian consultation visits\b/gi,
   '營養師諮詢以外的覆診門診', '营养师咨询以外的复诊门诊'],
  [/\bdietitian consultation follow-up outpatient visits?\b/gi, '營養師覆診門診', '营养师复诊门诊'],
  [/\bprior outpatient visits? or Emergency consultations?\b/gi,
   '之前的門診或急症診症', '之前的门诊或急症诊症'],
  [/\bSpecified Endoscopy Procedures?\b/gi, '指明內視鏡檢查程序', '指明内视镜检查程序'],
  [/\bSchedule of Surgical Procedures\b/gi, '《外科手術表》', '《外科手术表》'],
  [/\bsurgical category for the surgery\b/gi, '該手術的手術分類', '该手术的手术分类'],
  [/\bexcept in the cases stated in Section\s*([\d\w.()]+)/gi,
   '除第 $1 節所述情況外', '除第 $1 节所述情况外'],
  // ---- time windows ----
  [/\bwithin\s+(\d+)\s+days? before each Confinement or Day Case Procedure\b/gi,
   '每次住院或日間手術程序前 $1 日內', '每次住院或日间手术程序前 $1 日内'],
  [/\bmore than\s+(\d+)\s+days? before each Confinement or Day Case Procedure\b/gi,
   '每次住院或日間手術程序前超過 $1 日', '每次住院或日间手术程序前超过 $1 日'],
  [/\bwithin\s+(\d+)\s+days? after each discharge from Hospital or completion of Day Case Procedure( for performing the surgical procedure categorized as)?\b/gi,
   '每次出院或完成日間手術程序後 $1 日內', '每次出院或完成日间手术程序后 $1 日内'],
  [/\bwithin\s+(\d+)\s+days?\b/gi, '$1 日內', '$1 日内'],
  [/\bmore than\s+(\d+)\s+days?\b/gi, '超過 $1 日', '超过 $1 日'],
  [/\b(\d+)\s+days? before each admission\b/gi, '每次入院前 $1 日', '每次入院前 $1 日'],
  // ---- benefit-item references ----
  [/\b(?:benefit\s+)?limits? of benefit items?\s*\(?([a-z])\)?/gi,
   '保障項目 ($1) 的賠償限額', '保障项目 ($1) 的赔偿限额'],
  [/\b(?:benefit\s+)?limits? of benefits?\s*\(([IVX]+)\)/gi,
   '保障 ($1) 的限額', '保障 ($1) 的限额'],
  [/\(?\bitems?\s+\(?([a-z])\)?\s*[-–—]\s*\(?([a-z])\)?\)?/gi,
   '保障項目 ($1) – ($2)', '保障项目 ($1) – ($2)'],
  // ---- named benefit groups / defined terms ----
  [/\bBenefit Contribution Amount\b/gi, '保障分擔額', '保障分担额'],
  [/\bProsthetic Devices?\b/gi, '義肢裝置', '义肢装置'],
  [/\bmedical implants?\b/gi, '醫療植入物', '医疗植入物'],
  [/\bmedical appliances? benefit\b/gi, '醫療器具保障', '医疗器具保障'],
  [/\bDay Case Procedures?\b/gi, '日間手術程序', '日间手术程序'],
  [/\bDay Patients?\b/gi, '日間病人', '日间病人'],
  [/\bEnhanced [Bb]enefits\b/gi, '增強保障', '增强保障'],
  [/\bBasic [Bb]enefits\b/gi, '基本保障', '基本保障'],
  [/\bOther [Bb]enefits\b/gi, '其他保障', '其他保障'],
  [/\bOther Surgeries\b/gi, '其他手術', '其他手术'],
  [/\bTerms and Conditions\b/gi, '保單條款', '保单条款'],
  [/\bthe Supplement\b/gi, '《附加契約》', '《附加契约》'],
  // ---- therapies ----
  [/\bphysiotherapy\b/gi, '物理治療', '物理治疗'],
  [/\bchiropractic treatment\b/gi, '脊醫治療', '脊医治疗'],
  [/\boccupational therapy\b/gi, '職業治療', '职业治疗'],
  [/\bspeech therapy\b/gi, '言語治療', '言语治疗'],
  // ---- cover position ----
  [/\bfull(y)?\s*cover(ed|age)?\b/gi, '全數保障', '全数保障'],
  [/\bno\s+dollar\s+limit\b/gi, '不設分項賠償限額', '不设分项赔偿限额'],
  [/\bno\s+itemised\s+sublimit\b/gi, '不設分項賠償限額', '不设分项赔偿限额'],
  [/\bunlimited\b/gi, '無限額', '无限额'],
  [/\bactual\s+cost\b/gi, '實際費用', '实际费用'],
  [/\bnil\b/gi, '無', '无'],
  // ---- units ----
  [/\bper\s+policy\s+year\b/gi, '每保單年度', '每保单年度'],
  [/\bper\s+day\b/gi, '每日', '每日'],
  [/\bper\s+visit\b/gi, '每次診症', '每次诊症'],
  [/\bper\s+surgery\b/gi, '每項手術', '每项手术'],
  [/\bper\s+accident\b/gi, '每宗意外', '每宗意外'],
  [/\bper\s+incident\b/gi, '每宗事故', '每宗事故'],
  [/\bper\s+confinement\b/gi, '每次住院', '每次住院'],
  [/\bper\s+disability\b/gi, '每項傷殘', '每项伤残'],
  [/\bper\s+procedure\b/gi, '每項程序', '每项程序'],
  [/\bper\s+month\b/gi, '每月', '每月'],
  [/\bmax(imum)?\s+(\d+)\s+days?\b/gi, '最多 $2 日', '最多 $2 日'],
  [/\blump\s*sum\b/gi, '一筆過', '一笔过'],
  [/\beach\s+item\b/gi, '每項', '每项'],
  // ---- surgical categories ----
  [/\bcomplex\b/gi, '複雜', '复杂'],
  [/\bmajor\b/gi, '大型', '大型'],
  [/\bintermediate\b/gi, '中型', '中型'],
  [/\bminor\b/gi, '小型', '小型'],
  [/regardless of (the )?surgical categor(y|ies)/gi, '不論手術分類', '不论手术分类'],
  // ---- coinsurance / deductible ----
  [/(\d+)%\s*of\s*surgeon'?s?\s*fee\s*payable/gi, '外科醫生費的 $1%', '外科医生费的 $1%'],
  [/(\d+)%\s*coinsurance/gi, '$1% 共同保險', '$1% 共同保险'],
  [/\bCoinsurance\b/gi, '共同保險', '共同保险'],
  [/\bDeductibles?\b/gi, '自付費', '自付费'],
  // ---- generic connectives, last of all ----
  [/\bsubject to\b/gi, '設', '设'],
  [/\bif applicable\b/gi, '如適用', '如适用'],
  [/\bwhere applicable\b/gi, '如適用', '如适用'],
  [/\bfor the following specified visits\b/gi, '就以下指明診症', '就以下指明诊症'],
  [/\bexcluding\b/gi, '不包括', '不包括'],
  [/\bdischarge from Hospital\b/gi, '出院', '出院'],
  [/\bfollow-up outpatient visits?\b/gi, '覆診門診', '复诊门诊'],
  [/\boutpatient visits?\b/gi, '門診', '门诊'],
  [/\bEmergency consultations?\b/gi, '急症診症', '急症诊症'],
  [/\bbenefit limits?\b/gi, '賠償限額', '赔偿限额'],
  [/\bbenefit items?\b/gi, '保障項目', '保障项目'],
  [/\bpolicy year\b/gi, '保單年度', '保单年度'],
  [/\bConfinements?\b/gi, '住院', '住院'],
  [/\bSection\s*([\d\w.()]+)/gi, '第 $1 節', '第 $1 节'],
  [/\bof Part\s*([\d\w.]+)/gi, '第 $1 部', '第 $1 部'],
  [/\bbefore each admission\b/gi, '每次入院前', '每次入院前'],
  [/\bafter each discharge\b/gi, '每次出院後', '每次出院后'],
  [/\bAll\b/g, '所有', '所有'],
  [/\ball\b/g, '所有', '所有'],
  [/\s+and\s+/g, ' 及 ', ' 及 '],
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

// Node (the test suite) loads this as a module; the browser loads it as a plain
// script and ignores the export.
if (typeof module !== 'undefined') {
  module.exports = { T, LANGS, BENEFIT_NAMES, LIMIT_RULES, trLimit,
                     setLangForTest: (l) => { LANG = l; } };
}

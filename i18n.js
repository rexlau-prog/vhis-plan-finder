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
    taxoTitle: 'Benefit-by-benefit comparison',
    taxoNote: 'The 12 basic benefits are set by the VHIS Schedule and are directly comparable. The remaining rows re-file each insurer\u2019s own benefit names onto shared headings, so a dash means the plan publishes nothing under that heading \u2014 not that a claim would be refused. Read the plan document before advising.',
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
    taxoTitle: '逐項保障比較',
    taxoNote: '12 項基本保障由自願醫保計劃附表訂明，可直接比較。其餘各行是把各保險公司自訂的保障名稱歸入共用標題，因此「—」表示該計劃在此標題下沒有公布保障，並不等於索償會被拒。提供建議前請查閱計劃文件。',
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
      'gastroscopy + colonoscopy': '胃鏡及大腸鏡檢查',
      'haemorrhoidectomy': '痔瘡切除術',
      'hernia repair': '疝氣修補術',
      'hysterectomy': '子宮切除術',
      'knee arthroscopy': '膝關節鏡手術',
      'laminectomy': '椎板切除術',
      'laryngoscopy': '喉鏡檢查',
      'mastectomy': '乳房切除術',
      'myomectomy': '子宮肌瘤切除術',
      'ovarian cystectomy': '卵巢囊腫切除術',
      'hepatectomy': '肝切除術',
      'lasik': '激光矯視',
      'lithotripsy': '碎石術',
      'prostate biopsy': '前列腺活組織檢查',
      'radical prostatectomy (robot-assisted)': '機械臂根治性前列腺切除術',
      'septoplasty': '鼻中隔整形術',
      'submandibulectomy': '頜下唾液腺切除術',
      'total knee replacement (robot-assisted)': '機械臂全膝關節置換術',
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
    taxoTitle: '逐项保障比较',
    taxoNote: '12 项基本保障由自愿医保计划附表订明，可直接比较。其余各行是把各保险公司自订的保障名称归入共用标题，因此「—」表示该计划在此标题下没有公布保障，并不等于索偿会被拒。提供建议前请查阅计划文件。',
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
      'gastroscopy + colonoscopy': '胃镜及结肠镜检查',
      'haemorrhoidectomy': '痔疮切除术',
      'hernia repair': '疝修补术',
      'hysterectomy': '子宫切除术',
      'knee arthroscopy': '膝关节镜手术',
      'laminectomy': '椎板切除术',
      'laryngoscopy': '喉镜检查',
      'mastectomy': '乳房切除术',
      'myomectomy': '子宫肌瘤切除术',
      'ovarian cystectomy': '卵巢囊肿切除术',
      'hepatectomy': '肝切除术',
      'lasik': '激光矫视',
      'lithotripsy': '碎石术',
      'prostate biopsy': '前列腺活组织检查',
      'radical prostatectomy (robot-assisted)': '机械臂根治性前列腺切除术',
      'septoplasty': '鼻中隔整形术',
      'submandibulectomy': '颌下唾液腺切除术',
      'total knee replacement (robot-assisted)': '机械臂全膝关节置换术',
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
  // ---- supplementary-benefit clauses (the detail drawer) ----
  // These codes never appear in the comparison table, so they were left behind
  // when the six headline items were translated. Longest phrase first, as
  // always: a short rule above a long one eats its phrase.
  [/\bPayable according to the benefit limits of respective benefit items\b/gi,
   '按下列各保障項目的賠償限額支付', '按下列各保障项目的赔偿限额支付'],
  [/\bhome nursing services provided by a Registered Nurse\b/gi,
   '由註冊護士提供的家居護理服務', '由注册护士提供的家居护理服务'],
  [/\bservices provided by a Registered Nurse\b/gi,
   '由註冊護士提供的服務', '由注册护士提供的服务'],
  [/\bwithin\s+(\d+)\s+days? after discharge from Hospital following a surgical procedure\b/gi,
   '手術後出院起 $1 日內', '手术后出院起 $1 日内'],
  [/\bwithin\s+(\d+)\s+days? after discharge from Hospital or completion of Day Case Procedure\b/gi,
   '出院或完成日間手術程序後 $1 日內', '出院或完成日间手术程序后 $1 日内'],
  [/\bwithin\s+(\d+)\s+days? before admission or Day Case Procedure\b/gi,
   '入院或日間手術程序前 $1 日內', '入院或日间手术程序前 $1 日内'],
  [/\bfollowing surgery or admission to Intensive Care Unit\b/gi,
   '於手術後或入住深切治療部後', '于手术后或入住深切治疗部后'],
  [/\bduring which surgical procedure categoris?zed as\b/gi,
   '期間所進行、分類為', '期间所进行、分类为'],
  [/\bhas been performed on the Insured Person\b/gi, '之手術', '之手术'],
  [/\b(\d+)% of total transplantation cost\b/gi, '移植手術總費用的 $1%', '移植手术总费用的 $1%'],
  [/\bFor transplantation of\b/gi, '適用於以下器官移植：', '适用于以下器官移植：'],
  [/\bbone marrow\b/gi, '骨髓', '骨髓'],
  // Organ names — these appear almost only in the transplant/dialysis rows, so a
  // blanket mapping is safe here and leaves no half-English list like
  // "適用於以下器官移植： heart，kidney，liver，lung or 骨髓".
  [/\bsmall (?:bowel|intestine)\b/gi, '小腸', '小肠'],
  [/\bheart\b/gi, '心臟', '心脏'],
  [/\bkidneys?\b/gi, '腎臟', '肾脏'],
  [/\blivers?\b/gi, '肝臟', '肝脏'],
  [/\blungs?\b/gi, '肺', '肺'],
  [/\bcorneas?\b/gi, '角膜', '角膜'],
  [/\bpancreas\b/gi, '胰臟', '胰脏'],
  [/\bof Relevant Benefit Payable\b/gi, '相關應付保障', '相关应付保障'],
  [/\b(\d+)\s*prior\s*\+\s*(\d+)\s*follow-up visits?\b/gi,
   '$1 次事前診症 + $2 次覆診', '$1 次事前诊症 + $2 次复诊'],
  [/\bMaximum\s+(\d+)\s+days? per Policy Year\b/gi, '每保單年度最多 $1 日', '每保单年度最多 $1 日'],
  [/\b(\d+)\s+visits? per day\b/gi, '每日 $1 次診症', '每日 $1 次诊症'],
  [/\bper Living Donor Surgery\b/gi, '每次活體捐贈者手術', '每次活体捐赠者手术'],
  [/\bper Specific Cancer Surgery\b/gi, '每次指定癌症手術', '每次指定癌症手术'],
  [/\bper Accident\s*\/\s*mastectomy\b/gi, '每宗意外／乳房切除術', '每宗意外／乳房切除术'],
  [/\bper non-surgical cancer treatment\b/gi, '每次非手術癌症治療', '每次非手术癌症治疗'],
  [/\bDesignated Critical Illness(es)?\b/gi, '指定危疾', '指定危疾'],
  [/\bIntensive Care Unit\b/gi, '深切治療部', '深切治疗部'],
  [/\bNot applicable\b/gi, '不適用', '不适用'],
  [/\bApplicable\b/gi, '適用', '适用'],
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
  [/\bMaximum\b/g, '最多', '最多'],
  [/\bmaximum\b/g, '最多', '最多'],
  [/\b(\d+)\s+visits?\b/gi, '$1 次診症', '$1 次诊症'],
  [/\bvisits?\b/gi, '診症', '诊症'],
  [/\bup to\b/gi, '最高至', '最高至'],
  [/\btaking place\b/gi, '發生', '发生'],
  [/\bmonths?\b/gi, '個月', '个月'],
  [/\bdays?\b/gi, '日', '日'],
  [/\bunder the\b/gi, '根據', '根据'],
  // ---- whole clauses ----
  // Sentences common enough to be worth translating end-to-end. Doing it as a
  // WHOLE clause is what makes these safe: the Chinese is written to read
  // correctly on its own rather than assembled from substituted fragments.
  [/\bPayable after exceeding the benefit amount payable under item\s*([IVX]+\s*\([a-z]\))/gi,
   '超出第 $1 項可賠保障金額後方可賠償', '超出第 $1 项可赔保障金额后方可赔偿'],
  [/\bPayable after exceeding the benefit amount payable under\b/gi,
   '超出以下項目可賠保障金額後方可賠償：', '超出以下项目可赔保障金额后方可赔偿：'],
  [/\bwithin (\d+) hours? of the Accident\b/gi, '意外發生後 $1 小時內', '意外发生后 $1 小时内'],
  [/\bwithin (\d+) days? of the Accident\b/gi, '意外發生後 $1 日內', '意外发生后 $1 日内'],
  [/\b(\d+)% of the sum of surgical expenses for organ transplantation\b/gi,
   '器官移植手術費用總額的 $1%', '器官移植手术费用总额的 $1%'],

  // ---- gaps the live drawer exposed ----
  [/\bwithin (\d+) days? after discharge from Hospital\b/gi, '出院後 $1 日內', '出院后 $1 日内'],
  [/\bservices provided by (\d+) Registered Nurse[s]?\b/gi,
   '由 $1 名註冊護士提供之服務', '由 $1 名注册护士提供之服务'],
  [/\bamounts? payable under\b/gi, '以下項目之可賠金額', '以下项目之可赔金额'],
  [/\bDesignated Healthcare Services Providers?\b/gi, '指定醫療服務提供者', '指定医疗服务提供者'],
  [/\bmainland China\b/gi, '中國內地', '中国内地'],
  [/\bdialysis\b/gi, '透析', '透析'],
  [/\bsurgeries\b/gi, '手術', '手术'],
  [/\bsurgery\b/gi, '手術', '手术'],
  [/\bincurred\b/gi, '所產生', '所产生'],

  // ---- recurring boilerplate ----
  // Only phrases that map IN PLACE. Plenty of frequent spans are deliberately
  // absent — "starting from the", "services provided by", "payable after
  // exceeding the" are postpositional in Chinese, so substituting them where
  // they stand scrambles the clause. Those stay English on purpose.
  [/\bthe Terms and Benefits\b/gi, '《保單條款及權益》', '《保单条款及权益》'],
  [/\bTerms and Benefits\b/gi, '《保單條款及權益》', '《保单条款及权益》'],
  [/\bsleep apnea tests?\b/gi, '睡眠窒息症檢查', '睡眠窒息症检查'],
  [/\bprescribed non-surgical cancer treatments?\b/gi, '處方非手術癌症治療', '处方非手术癌症治疗'],
  [/\bpre-approval by the [Cc]ompany\b/gi, '須經本公司預先批核', '须经本公司预先批核'],
  [/\bin accordance with\b/gi, '按照', '按照'],
  [/\bin excess of the\b/gi, '超出', '超出'],
  [/\bin excess of\b/gi, '超出', '超出'],
  [/\bfor each disability\b/gi, '每次傷殘', '每次伤残'],
  [/\bunder basic benefit\b/gi, '（基本保障下）', '（基本保障下）'],
  [/\bdue to strokes?\b/gi, '因中風', '因中风'],
  [/\bas a direct result of\b/gi, '直接因以下原因引致：', '直接因以下原因引致：'],
  [/\bper continuous twenty-four hours?\b/gi, '每連續二十四小時', '每连续二十四小时'],
  [/\bin total for\b/gi, '合共', '合共'],

  // ---- defined terms ----
  // Nouns with a settled Chinese equivalent in HK policy wording. These are
  // TERMS, not grammar: each maps one-for-one, so translating them cannot change
  // what a condition means. The clause structure around them is deliberately
  // left in English — see the note above LIMIT_RULES.
  // Multi-word entries must stay ABOVE the connectives below, or "and"/"or"
  // would split them ("Room 及 Board").
  [/\bRoom and Board\b/gi, '病房及膳食', '病房及膳食'],
  [/\bIntensive Care Unit\b/gi, '深切治療部', '深切治疗部'],
  [/\bAnnual Benefit Limit\b/gi, '每年保障限額', '每年保障限额'],
  [/\bLifetime Benefit Limit\b/gi, '終身保障限額', '终身保障限额'],
  [/\bEligible Expenses?\b/gi, '合資格費用', '合资格费用'],
  [/\bRegistered Nurse\b/gi, '註冊護士', '注册护士'],
  [/\bsurgical procedures?\b/gi, '外科手術', '外科手术'],
  [/\bday case procedures?\b/gi, '日間手術', '日间手术'],
  [/\bprescribed (?:medicines?|drugs?)\b/gi, '處方藥物', '处方药物'],
  [/\bspecialist\b/gi, '專科醫生', '专科医生'],
  [/\banaesthetists?\b/gi, '麻醉科醫生', '麻醉科医生'],
  [/\bradiologists?\b/gi, '放射科醫生', '放射科医生'],
  [/\bsurgeons?\b/gi, '外科醫生', '外科医生'],
  [/\bphysicians?\b/gi, '醫生', '医生'],
  [/\breimbursements?\b/gi, '賠償', '赔偿'],
  [/\boutpatients?\b/gi, '門診', '门诊'],
  [/\binpatients?\b/gi, '住院', '住院'],
  [/\bhospitals?\b/gi, '醫院', '医院'],
  [/\bdiagnos(?:is|tic)\b/gi, '診斷', '诊断'],
  [/\btreatments?\b/gi, '治療', '治疗'],
  [/\bconsultations?\b/gi, '診症', '诊症'],
  [/\bAll\b/g, '所有', '所有'],
  [/\bor\b/gi, '或', '或'],
  [/\band\b/gi, '及', '及'],
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
// Longest alternative FIRST — regex alternation is leftmost-first, so a short
// unit listed before a longer one containing it would split the longer phrase
// ("每宗意外" would tear "每宗意外／乳房切除術" in half).
const UNITS = [
  '每宗意外／乳房切除術', '每宗意外/乳房切除术',
  '每次活體捐贈者手術', '每次活体捐赠者手术',
  '每次指定癌症手術', '每次指定癌症手术',
  '每次非手術癌症治療', '每次非手术癌症治疗',
  '每保單年度', '每保单年度', '每次診症', '每次诊症',
  '每月', '每星期', '每年', '每次住院',
  '每項手術', '每项手术', '每宗意外', '每宗事故',
  '每日', '每項', '每项',
].join('|');
const REORDER = [
  // `\d[\d,]*` not `[\d,]+`: the latter matches a BARE COMMA, so a list like
  // "…最多 30 日, 每日 2 次診症" had its comma treated as the number and the
  // following unit swapped onto it — "每保單年度每日 最多 30 日 , 2 次診症".
  [new RegExp(`(\\$?\\d[\\d,]*(?:\\.\\d+)?)\\s*(${UNITS})`, 'g'), '$2 $1'],
  [new RegExp(`(最多\\s*\\d+\\s*(?:次診症|個月|个月|日|次|週|周))\\s*(${UNITS})`, 'g'), '$2 $1'],
  // "最高至 每保單年度 $3,000" reads as a dangling preposition in Chinese; the
  // unit belongs in front of the cap — "每保單年度最高 $3,000".
  [new RegExp(`最高至\\s*(${UNITS}|每次傷殘|每次伤残|每次住院)\\s*(\\$?\\d[\\d,]*)`, 'g'), '$1最高 $2'],
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
// Supplementary (non-statutory) benefit names. The statutory items a-l are a
// fixed list in BENEFIT_NAMES; everything above them is each insurer's own
// wording, 595 distinct titles once footnote markers are folded away. These are
// exact matches rather than rewrite rules: a benefit TITLE has to be right, and
// assembling one from substituted words is how "Room and Board" became
// "Room 及 Board".
const SUPP_NAMES = {
  "compassionate death benefit": ["恩恤身故保障", "恩恤身故保障"],
  "accidental death benefit": ["意外身故保障", "意外身故保障"],
  "death benefit": ["身故保障", "身故保障"],
  "companion bed": ["陪伴床位", "陪伴床位"],
  "hospital companion bed": ["醫院陪伴床位", "医院陪伴床位"],
  "hospital companion bed benefit": ["醫院陪伴床位保障", "医院陪伴床位保障"],
  "pregnancy complications": ["懷孕併發症", "怀孕并发症"],
  "complications of pregnancy": ["懷孕併發症", "怀孕并发症"],
  "outpatient kidney dialysis": ["門診腎臟透析", "门诊肾脏透析"],
  "kidney dialysis": ["腎臟透析", "肾脏透析"],
  "hospice care": ["善終護理", "善终护理"],
  "hospice and palliative care": ["善終及紓緩護理", "善终及纾缓护理"],
  "post-confinement home nursing": ["出院後家居護理", "出院后家居护理"],
  "post-surgery home nursing": ["手術後家居護理", "手术后家居护理"],
  "home nursing": ["家居護理", "家居护理"],
  "private nursing": ["私家看護", "私家看护"],
  "private nurse's fee": ["私家看護費", "私家看护费"],
  "medical negligence benefit": ["醫療疏忽保障", "医疗疏忽保障"],
  "emergency outpatient care": ["急症門診護理", "急症门诊护理"],
  "room and board": ["病房及膳食", "病房及膳食"],
  "operating theatre charges": ["手術室費用", "手术室费用"],
  "miscellaneous charges": ["雜項費用", "杂项费用"],
  "intensive care": ["深切治療", "深切治疗"],
  "isolation room": ["隔離病房", "隔离病房"],
  "donor's benefit": ["捐贈者保障", "捐赠者保障"],
  "expenses for living donor surgery": ["活體捐贈者手術費用", "活体捐赠者手术费用"],
  "accidental outpatient treatment": ["意外門診治療", "意外门诊治疗"],
  "emergency outpatient accidental treatment": ["急症門診意外治療", "急症门诊意外治疗"],
  "emergency outpatient treatment for accident": ["意外急症門診治療", "意外急症门诊治疗"],
  "emergency outpatient treatment for accidents": ["意外急症門診治療", "意外急症门诊治疗"],
  "emergency outpatient treatment benefit (accident only)": ["急症門診治療保障（只限意外）", "急症门诊治疗保障（只限意外）"],
  "emergency outpatient dental treatment": ["急症門診牙科治療", "急症门诊牙科治疗"],
  "emergency dental care": ["急症牙科護理", "急症牙科护理"],
  "surgeon's fee": ["外科醫生費", "外科医生费"],
  "anaesthetist's fee": ["麻醉科醫生費", "麻醉科医生费"],
  "specialist's fee": ["專科醫生費", "专科医生费"],
  "attending doctor's visit fee": ["主診醫生巡房費", "主诊医生巡房费"],
  "medical appliances benefit for reconstructive surgery": ["重建手術醫療器材保障", "重建手术医疗器材保障"],
  "reconstructive surgery benefit": ["重建手術保障", "重建手术保障"],
  "specified reconstructive surgery benefit": ["指定重建手術保障", "指定重建手术保障"],
  "reconstructive surgery for specific cancer": ["指定癌症重建手術", "指定癌症重建手术"],
  "rehabilitation": ["復康治療", "复康治疗"],
  "rehabilitation benefit": ["復康治療保障", "复康治疗保障"],
  "rehabilitation treatment": ["復康治療", "复康治疗"],
  "stroke rehabilitation treatment - disability subsidy benefit": ["中風復康治療 — 傷殘補助保障", "中风复康治疗 — 伤残补助保障"],
  "stroke rehabilitation treatment - home facility enhancement benefit": ["中風復康治療 — 家居設施改善保障", "中风复康治疗 — 家居设施改善保障"],
  "stroke rehabilitation treatment - stroke ancillary benefit": ["中風復康治療 — 中風輔助保障", "中风复康治疗 — 中风辅助保障"],
  "cash benefit for top-up subsidy": ["補助現金保障", "补助现金保障"],
  "cash benefit for designated day case procedures": ["指定日間手術現金保障", "指定日间手术现金保障"],
  "medical accident and incident extension benefit": ["醫療事故及意外延伸保障", "医疗事故及意外延伸保障"],
  "traditional chinese medicine for specified cancer": ["指定癌症中醫治療", "指定癌症中医治疗"],
  "non-conventional treatment for covered cancer": ["受保癌症非傳統治療", "受保癌症非传统治疗"],
  "post-confinement/day case procedure chinese medicine treatment": ["出院／日間手術後中醫治療", "出院／日间手术后中医治疗"],
  "post-surgical procedure/day case procedure chinese medicine practitioner outpatient care": ["手術／日間手術後中醫門診護理", "手术／日间手术后中医门诊护理"],
  "consultation or acupuncture by a registered chinese medicine practitioner after confinement or specific treatments": ["出院或特定治療後註冊中醫診症或針灸", "出院或特定治疗后注册中医诊症或针灸"],
  "additional post-confinement/day case procedure outpatient ancillary benefit": ["出院／日間手術後額外門診輔助保障", "出院／日间手术后额外门诊辅助保障"],
  "day patient kidney dialysis": ["日間病人腎臟透析", "日间病人肾脏透析"],
  "dialysis": ["透析治療", "透析治疗"],
  "treatments for outpatient kidney dialysis": ["門診腎臟透析治療", "门诊肾脏透析治疗"],
  "prosthetic device": ["義肢裝置", "义肢装置"],
  "medical implants": ["醫療植入物", "医疗植入物"],
  "medical implants - other items": ["醫療植入物 — 其他項目", "医疗植入物 — 其他项目"],
  "post-confinement/day case procedure outpatient ancillary benefit": ["出院／日間手術後門診輔助保障", "出院／日间手术后门诊辅助保障"],
  "pre- and post-confinement / day case procedure outpatient care": ["住院／日間手術前後門診護理", "住院／日间手术前后门诊护理"],
  "second claims incentive": ["第二次索償獎賞", "第二次索偿奖赏"],
  "home facility enhancement due to stroke": ["因中風之家居設施改善", "因中风之家居设施改善"],
  "prescribed non-surgical cancer treatments": ["處方非手術癌症治療", "处方非手术癌症治疗"],
  "check-up benefit": ["身體檢查保障", "身体检查保障"],
  "emergency outpatient treatment benefit": ["急症門診治療保障", "急症门诊治疗保障"],
  "emergency outpatient treatment": ["急症門診治療", "急症门诊治疗"],
  "emergency outpatient treatment due to accident": ["因意外之急症門診治療", "因意外之急症门诊治疗"],
  "emergency outpatient dental treatment due to accident": ["因意外之急症門診牙科治療", "因意外之急症门诊牙科治疗"],
  "cash benefit for confinement in lower ward class of a private hospital": ["入住私家醫院較低級別病房現金保障", "入住私家医院较低级别病房现金保障"],
  "cash benefit for room and board confinement below entitled ward class in a private hospital in hong kong": ["入住香港私家醫院低於合資格級別病房之病房及膳食現金保障", "入住香港私家医院低于合资格级别病房之病房及膳食现金保障"],
  "cash benefit for confinement in intensive care unit in hong kong": ["入住香港深切治療部現金保障", "入住香港深切治疗部现金保障"],
  "supplementary major medical benefit": ["附加住院及手術保障", "附加住院及手术保障"],
  "personal medical case management services": ["個人醫療個案管理服務", "个人医疗个案管理服务"],
  "non-confinement sleep apnea test": ["非住院睡眠窒息症檢查", "非住院睡眠窒息症检查"],
  "phase 3 clinical trial drugs benefit for stage iii and stage iv specified cancers and incurable haematological malignancy": ["第三及第四期指定癌症與不可治癒血液惡性腫瘤之第三期臨床試驗藥物保障", "第三及第四期指定癌症与不可治愈血液恶性肿瘤之第三期临床试验药物保障"],
  "top-up subsidy benefit": ["補助保障", "补助保障"],
  "day case procedure cash allowance": ["日間手術現金津貼", "日间手术现金津贴"],
  "cash benefit for day case procedure": ["日間手術現金保障", "日间手术现金保障"],
  "day surgery cash benefit": ["日間手術現金保障", "日间手术现金保障"],
  "outpatient surgery cash allowance": ["門診手術現金津貼", "门诊手术现金津贴"],
  "special cash allowance": ["特別現金津貼", "特别现金津贴"],
  "hospitalization transportation cash allowance": ["住院交通現金津貼", "住院交通现金津贴"],
  "medical negligence coverage": ["醫療疏忽保障", "医疗疏忽保障"],
  "hospice care benefit": ["善終護理保障", "善终护理保障"],
  "ancillary services (physiotherapy / occupational therapy / speech therapy / chiropractic treatment)": ["輔助服務（物理治療／職業治療／言語治療／脊醫治療）", "辅助服务（物理治疗／职业治疗／言语治疗／脊医治疗）"],
  "chinese medicine practitioner outpatient care": ["中醫門診護理", "中医门诊护理"],
  "post-confinement/day case procedure chinese medicine practitioner outpatient care": ["出院／日間手術後中醫門診護理", "出院／日间手术后中医门诊护理"],
  "additional benefit for prescribed non-surgical cancer treatments, kidney dialysis and organ or bone marrow transplantation": ["處方非手術癌症治療、腎臟透析及器官或骨髓移植額外保障", "处方非手术癌症治疗、肾脏透析及器官或骨髓移植额外保障"],
  "prescribed diagnostic imaging tests": ["處方診斷造影檢查", "处方诊断造影检查"],
  "rehabilitative care": ["復康護理", "复康护理"],
  "reconstructive surgery": ["重建手術", "重建手术"],
  "registered private nurse's fees": ["註冊私家看護費用", "注册私家看护费用"],
  "companion bed at hospital": ["醫院陪伴床位", "医院陪伴床位"],
  "severe urban chronic disease additional benefit": ["嚴重都市慢性病額外保障", "严重都市慢性病额外保障"],
  "cash benefit for major and complex surgeries": ["大型及複雜手術現金保障", "大型及复杂手术现金保障"],
  "cash benefit for day case procedure - designated day case procedure(s) performed at a designated healthcare services provider or in mainland china": ["日間手術現金保障 — 於指定醫療服務提供者或中國內地進行之指定日間手術", "日间手术现金保障 — 于指定医疗服务提供者或中国内地进行之指定日间手术"],
};

// "Hospice care" and "Hospice care (7)" are the same benefit wearing a
// document-specific footnote marker. Fold the marker away for the lookup and
// put it back afterwards, so one entry serves every variant.
const NAME_MARKER = /\s*\((\d{1,2})\)\s*$/;
function normName(s) {
  // Markers also appear MID-title ("Non-conventional Treatment (16) for Covered
  // Cancer"), so strip every one for the lookup key. Only the trailing marker is
  // restored afterwards — an interior one has no unambiguous home in the Chinese
  // word order, and the note tooltip is keyed on the row, not the position.
  return String(s || '').replace(/\s*\(\d{1,2}\)/g, '')
                        .replace(/\s+/g, ' ').trim().toLowerCase();
}

function trBenefitName(code, name) {
  if (LANG === 'en') return name;
  const i = LANG === 'hk' ? 0 : 1;
  const e = BENEFIT_NAMES[(code || '').toLowerCase()];
  if (e) return e[i];
  const supp = SUPP_NAMES[normName(name)];
  if (!supp) return name;                       // untitled in our map: show it as published
  const m = NAME_MARKER.exec(String(name || ''));
  return supp[i] + (m ? ` (${m[1]})` : '');     // keep the marker; the note tooltip reads it
}

// Node (the test suite) loads this as a module; the browser loads it as a plain
// script and ignores the export.
if (typeof module !== 'undefined') {
  module.exports = { T, LANGS, BENEFIT_NAMES, SUPP_NAMES, LIMIT_RULES, trLimit, trBenefitName,
                     setLangForTest: (l) => { LANG = l; } };
}

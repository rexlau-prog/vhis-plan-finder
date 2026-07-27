# VHIS Plan Finder

A quoting and comparison tool for Hong Kong insurance agents, covering **every
certified product** under the Voluntary Health Insurance Scheme (VHIS).

**▶ Live demo: https://rexlau-prog.github.io/vhis-plan-finder/**

Enter a client's age, gender, currency and payment frequency; the tool ranks all
sellable plans by premium, compares them side-by-side on both **cost and
coverage**, and exports a quote as CSV or PDF.

---

## What's in it

| Layer | Coverage |
|---|---|
| **Product catalog** | 579 certified products · 103 plan families · 33 insurers |
| **Premium tables** | 169,219 age-banded data points |
| **Benefit schedules** | 9,998 coverage-limit rows · all 521 sellable products |
| **Surgical categories** | 475 procedures from the Government schedule |
| **Cost benchmarks** | 34 procedures · 11 HK private hospitals |

Everything is sourced from the Hong Kong Government's official
[VHIS certified-plans open dataset](https://data.gov.hk/en-data/dataset/hk-hhb-hhbvhis-vhis-certified-plan)
(Health Bureau) plus the certified plan and premium PDFs published on
[vhis.gov.hk](https://www.vhis.gov.hk).

## Features

- **Trilingual — English / 繁體中文 / 简体中文.** Switch in the header; the choice
  is remembered, and the app opens in the browser's preferred language. Plan
  names, insurers and plan levels come from the Government's own trilingual
  dataset; benefit-item names and limit wording use the official Chinese terms
  from the regulator's Chinese plan documents (病房及膳食, 全數保障, 每保單年度 …).
  Search matches across all three languages at once.
- **Quote by client profile** — age 0–100, male/female, smoker/non-smoker,
  HKD/USD, annual or monthly. Handles gendered vs unisex rate tables, smoker
  loadings, and plans priced as basic + rider.
- **Rank and filter** — by insurer, Standard vs Flexi, "sellable only" (hides
  renewal-only and de-registered plans), SMM riders, free-text search.
- **Plan detail** — premium curve from age 1 to 80, the full benefit schedule
  (per-item limits, surgeon's-fee categories, coinsurance, annual/lifetime
  limits), and links to the official plan and premium documents.
- **Side-by-side comparison** — premium at the client's age plus at ages 30/50/65,
  against the key coverage lines (room & board, miscellaneous, ICU, surgeon's
  fee, diagnostic imaging, cancer treatment).
- **Coverage gap** — pick a procedure and see what a typical Hong Kong private
  hospital bill costs, what each plan would pay, and what the client is left
  with. Bills come from **11 private hospitals' published reference charges**;
  the surgeon's-fee cap comes from the Government's own **Schedule of Surgical
  Procedures** (475 procedures · Complex/Major/Intermediate/Minor). Always a
  range across hospitals, never a single invented figure. Where a procedure is
  VHIS-excluded (maternity, LASIK) it says so rather than showing a shortfall,
  and USD plans have their limits converted before comparison.
- **Export** — CSV stamped with the client's parameters, or a print/PDF quote sheet.

## How it works

A static site with **no backend**. The whole dataset ships as a gzipped SQLite
database (3.3 MB) that is inflated in the browser and queried client-side via
[sql.js](https://sql.js.org) (SQLite compiled to WebAssembly). That keeps it
free to host, instant to filter, and usable offline once loaded.

### The data pipeline

The substantial engineering is upstream — turning roughly a thousand regulator
PDFs into queryable data:

1. **Catalog** — the official JSON dataset, normalised to one row per certified
   product with a computed status (Open / Renewal-only / Unavailable /
   De-registered) so an agent is never shown a plan they can't sell.
2. **Premiums** — a positional PDF-table parser resolving each rate table into
   `age × gender × smoker × component × frequency`. It handles stacked
   sub-tables, header-less continuation pages, and headers spanning multiple
   panels. **519 of 521** products extract cleanly; the rest are flagged rather
   than guessed.
3. **Benefit schedules** — locating the benefit table inside each 40–60 page
   policy document, deduping 521 products to 364 distinct schedules, and
   extracting each into a shared VHIS benefit-item taxonomy.

Every stage is verified rather than assumed. Premiums pass an annual ≈ 11.3×
monthly ratio test (zero outliers across 261 products) and an age-monotonicity
test (1,996/1,996 series). Benefit schedules pass a completeness gate at
335/335, with ground-truth spot checks against the source PDFs.

## Running locally

```bash
python3 -m http.server 8000     # then open http://localhost:8000
```

---

## Disclaimer

For **insurance-agent reference only**. Premiums are non-guaranteed, exclude the
Insurance Authority levy, and vary by deductible, region and ward tier. Benefit
limits are summarised. Always verify against the official certified plan and
premium documents (linked from every plan in the app) before advising a client.
Not affiliated with the Health Bureau or any insurer.

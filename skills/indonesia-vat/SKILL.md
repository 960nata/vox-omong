---
name: indonesia-vat
description: Panduan keahlian indonesia-vat dari repo openaccountants/openaccountants
repo: openaccountants/openaccountants
license: MIT
---

# Indonesia VAT

## Indonesia PPN (Pajak Pertambahan Nilai / VAT) Skill v2.1

## Rates and thresholds

> Reviewed against the cited tax authorities by **RILIA PUTRI** on 2026-06-03.
> Items flagged for further clarification are tracked separately and excluded here.
> This block is generated from verified `skill_facts` — edit the facts, not the prose.

### PPN - VAT

- **Standard effective rate (non-luxury)** — 11% — nominal 12% applied to DPP of 11/12 × selling price  _(UU HPP Art. 7; PMK 131/2024)_
- **Luxury goods (PPnBM-listed) rate** — 12% on full DPP from 1 Feb 2025. Transitional 11/12 DPP in Jan 2025.  _(PMK 131/2024)_
- **Export rate** — 0% on goods; qualifying exported services  _(UU PPN Art. 7(2))_
- **PKP mandatory threshold** — IDR 4,800,000,000 annual turnover  _(UU PPN Art. 3A; PMK 197/2013)_
- **SPT Masa PPN filing deadline** — SPT Masa PPN must be filed no later than the end of the following month after the tax period ends (akhir bulan berikutnya setelah berakhirnya Masa Pajak).  _([UU KUP as amended by UU HPP No. 7/2021.](https://www.pajak.go.id/en/node/34988))_
- **PPN payment deadline** — PPN and PPnBM generally must be paid by the end of the month following the tax period and before the relevant SPT Masa PPN is submitted, subject to applicable VAT regulations.  _(UU KUP, PMK 81/2024 Article 94(3) as amended by PMK 01/2026; UU KUP as amended by UU HPP No. 7/2021.)_
- **Faktur Pajak issuance** — Faktur Pajak generally must be issued at the time of taxable supply or in accordance with applicable VAT invoicing and electronic tax administration regulations.  _(PMK-151/PMK.03/2013, Indonesian VAT Law Article 13, PER-11/PJ/2025, and PMK 81/2024 as amended by PMK 01/2026.)_
- **Input credit window** — Within 3 months of the tax period  _(UU PPN)_
- **Late filing SPT Masa PPN** — IDR 500,000 per month  _(UU KUP Art. 7)_
- **Late PPN payment** — Floating monthly rate set by the Minister of Finance (benchmark rate + 5% uplift ÷ 12; ~0.99% for March 2025 period) — no longer a fixed 2% per month  _([UU KUP Article 9(2a), Article 13(2)](https://fiskal.kemenkeu.go.id/informasi-publik/kmk-tarif-bunga))_
- **Late Faktur Pajak** — 1% of DPP per Faktur  _([Indonesian VAT Law Article 14(4)](https://www.pajak.go.id/en/node/101543))_
- **Underpayment on audit** — Interest (MoF reference-rate-based, per Art. 13(3b)) for income tax; 75% increase for VAT/PPnBM and for income tax withheld/collected but not deposited — no '100%' sanction exists in the current Art. 13(3)  _([UU KUP Article 13(3), UU KUP as amended by UU HPP No. 7/2021.](https://www.pajak.go.id/sites/default/files/2021-12/Salinan%20UU%20Nomor%207%20Tahun%202021.pdf))_
- **Basic food staples** — Basic food staples (rice, grain, corn, sago, soybeans, salt, meat, eggs, milk, fruits, vegetables) are NO LONGER exempted under Article 4A; UU HPP No. 7/2021 removed them from Article 4A(2)(b) and relocated the VAT-exemption facility to Article 16B(1a)(j) of the VAT Law  _([Indonesian VAT Law Article 4A as amended by UU HPP No. 7/2021](https://www.pajak.go.id/index.php/en/node/71871))_
- **Services exempt** — Medical, education, financial, insurance, employment, water supply  _(Indonesian VAT Law Article 4A as amended by UU HPP No. 7/2021, PMK 70/PMK.03/2022 Articles 3, 5–8)_
- **PMSE PPN rate** — 11% collected by registered foreign providers  _(Indonesian VAT Law Article 7, PMK 81/2024 Articles 332–339)_
- **PMSE registration threshold** — >IDR 600m annual turnover from Indonesia OR >12,000 users/year  _(PMK 81/2024 Articles 332–339)_
- **I.A — Taxable sales 11%** — Taxable supplies subject to VAT (Tax Base/DPP)  _(Indonesian VAT Law Articles 4 & 7; UU HPP No. 7/2021 Article 7)_
- **I.B — Zero-rated (exports)** — Exports  _(Indonesian VAT Law Articles 3A, 4(1)(f),(g),(h), & 7(2))_
- **I.C — Exempt/non-taxable** — VAT-exempt supplies  _(Indonesian VAT Law Article 4A as amended by UU HPP No. 7/2021; PMK 70/PMK.03/2022 Articles 3 & 5–8)_
- **II — Output PPN** — Output VAT  _(Indonesian VAT Law Articles 1A, 4, & 9)_
- **III.A — Domestic input PPN** — Domestic Input VAT  _(Indonesian VAT Law Article 9)_
- **IV — PPN payable** — Output VAT less allowable Input VAT  _(Indonesian VAT Law Article 9(2))_
- **Coretax mandatory from** — January 2025 implementation for VAT administration  _(PMK 81/2024 as amended by PMK 01/2026)_
- **e-Faktur system** — Mandatory for taxable entrepreneurs (PKPs); integrated with Coretax  _(Indonesian VAT Law Article 13; PER-11/PJ/2025; PMK 81/2024 as amended by PMK 01/2026)_
- **NPWP format on Faktur Pajak** — 16-digit NIK-based Taxpayer Identification Number  _(PMK-112/PMK.03/2022 Article 2(1)–(3) & PER-6/PJ/2024)_

## Section 1 — Quick reference

**Quick reference**

| Field | Value |
| --- | --- |
| Country | Indonesia (Republik Indonesia) |
| Tax | PPN — Pajak Pertambahan Nilai (Value Added Tax) |
| Currency | IDR (Indonesian Rupiah / Rupiah) |
| Tax year | Calendar year (1 Jan – 31 Dec) |
| Standard rate | Effective **11%** for non-luxury goods/services; **12%** for LGST-listed luxury goods from 1 Feb 2025. Under PMK 131/2024, the nominal rate is 12% but the tax base (DPP) for non-luxury supplies is 11/12 of the selling price, so the effective rate remains 11%. (See "Section — Recent changes (PMK 131/2024 + Coretax)" below.) |
| Zero rate | 0% (exports of goods; exported services meeting criteria) |
| Exempt | Basic food staples (beras, jagung, etc.), medical services, education, financial services, insurance, employment services, certain mining activities, water (drinking water supply) |
| PPnBM | Pajak Penjualan atas Barang Mewah (Luxury Goods Sales Tax) — separate 10%–200% on luxury items; out of scope for this skill |
| Registration threshold | IDR 4,800,000,000 per year (IDR 4.8 billion) |
| Taxable Entrepreneur | PKP (Pengusaha Kena Pajak) — mandatory registration above threshold |
| Tax authority | DJP (Direktorat Jenderal Pajak — Directorate General of Taxes) |
| Filing | SPT Masa PPN — monthly VAT return via e-Faktur application |
| Filing deadline | End of month following the tax period (e.g., April period → 31 May) |
| Payment deadline | End of month following the tax period |
| e-Faktur | Mandatory electronic tax invoice system — all PKPs must use |
| Tax invoice | Faktur Pajak — required for input credit |
| NPWP | Nomor Pokok Wajib Pajak (15-digit taxpayer ID) |
| Contributor | Open Accountants Community |
| Skill version | 2.0 |

### Key SPT Masa PPN form lines

**Key SPT Masa PPN form lines**

| Line | Meaning |
| --- | --- |
| I.A | Taxable sales at 11% (Penyerahan yang terutang PPN) |
| I.B | Zero-rated sales (Ekspor) |
| I.C | Exempt/non-taxable sales |
| II | Output PPN (Pajak Keluaran) |
| III.A | Input PPN from domestic purchases (Pajak Masukan) |
| III.B | Input PPN from imports |
| III.C | Input PPN not creditable (tidak dapat dikreditkan) |
| III.D | Net input PPN |
| IV | PPN payable (II − III.D) |
| V | Previous period excess credit (Lebih Bayar dikompensasi) |
| VI | Net payable or refund |

### Conservative defaults

**Conservative defaults**

| Ambiguity | Default |
| --- | --- |
| Unknown rate on a sale | 11% standard |
| Unknown counterparty registration (PKP or non-PKP) | Non-PKP — no input credit |
| Unknown counterparty country | Domestic Indonesia |
| Unknown export qualification | Domestic 11% until evidence confirmed |
| Unknown business-use % | 0% input credit |
| Unknown whether Faktur Pajak is available | No input credit |
| Unknown B2B vs B2C for digital services | B2C — 11% applicable |

### Red flag thresholds

**Red flag thresholds**

| Threshold | Value |
| --- | --- |
| HIGH single transaction | IDR 100,000,000 |
| HIGH tax delta on single default | IDR 11,000,000 |
| MEDIUM counterparty concentration | >40% of output or input |
| MEDIUM conservative default count | >4 per period |
| LOW absolute net PPN position | IDR 50,000,000 |

## Section 2 — Required inputs and refusal catalogue

### Required inputs

**Minimum viable** — bank statement for the month in CSV, PDF, or pasted text. NPWP (15-digit tax ID) and confirmation of PKP status.

**Recommended** — Faktur Pajak for all input credits, e-Faktur reports from DJP system, prior month excess credit (Lebih Bayar), SPTPD (period tax return).

**Ideal** — complete e-Faktur data export, import customs declarations (PIB — Pemberitahuan Impor Barang), asset register, full purchase/sales ledger.

**Refusal if minimum missing — SOFT WARN.** No bank statement = hard stop. "Input PPN credits require Faktur Pajak verified in the DJP e-Faktur system. All credits are provisional pending Faktur verification."

### Refusal catalogue

- **R-ID-1 — Non-PKP (below IDR 4.8B threshold)** — This business is not a Pengusaha Kena Pajak (PKP). Non-PKPs do not charge PPN and cannot recover input PPN. This skill covers PKP-registered businesses only.
- **R-ID-2 — Luxury goods tax (PPnBM)** — PPnBM on luxury goods (vehicles, electronics above threshold, jewellery, etc.) is a separate tax mechanism. Out of scope — escalate to a Konsultan Pajak.
- **R-ID-3 — Partial exemption (usaha campuran)** — Businesses making both taxable and exempt supplies must apportion input PPN. Apportionment requires the taxable/total ratio — out of scope without full-year data. Escalate.
- **R-ID-4 — Export refund (restitusi PPN)** — PPN refund claims for exporters require separate documentation and DGT audit. Out of scope — escalate.
- **R-ID-5 — Withholding PPN (Pemungut PPN)** — Government agencies and designated private companies act as PPN withholders. If your client has significant government contracts, the withheld PPN must be tracked and credited. Flag for specialist review.

## Section 3 — Supplier pattern library

Match by case-insensitive substring on counterparty name or reference. Most specific match wins. Fall through to Section 5 if no match.

### 3.1 Indonesian banks — fees and charges (exempt / exclude)

**3.1 Indonesian banks — fees and charges (exempt / exclude)**

| Pattern | Treatment | Notes |
| --- | --- | --- |
| BANK CENTRAL ASIA, BCA | EXCLUDE (fee lines) | Financial service — PPN exempt |
| BANK RAKYAT INDONESIA, BRI | EXCLUDE (fee lines) | Same |
| BANK NEGARA INDONESIA, BNI | EXCLUDE (fee lines) | Same |
| BANK MANDIRI | EXCLUDE (fee lines) | Same |
| CIMB NIAGA | EXCLUDE (fee lines) | Same |
| BANK DANAMON | EXCLUDE (fee lines) | Same |
| BANK PERMATA | EXCLUDE (fee lines) | Same |
| OVO (fintech) | EXCLUDE (fee lines) | E-wallet fee — exempt financial service |
| GOPAY, GOJEK (payment fee) | EXCLUDE (fee lines) | Same |
| DANA E-WALLET | EXCLUDE (fee lines) | Same |
| BIAYA ADMIN, BUNGA, FEE | EXCLUDE | Bank admin fee/interest — exempt |

### 3.2 Indonesian government and statutory (exclude)

**3.2 Indonesian government and statutory (exclude)**

| Pattern | Treatment | Notes |
| --- | --- | --- |
| DIREKTORAT JENDERAL PAJAK, DJP | EXCLUDE | Tax payment |
| PAJAK PERTAMBAHAN NILAI, PPN | EXCLUDE | Tax remittance |
| PAJAK PENGHASILAN, PPH | EXCLUDE | Income tax — out of PPN scope |
| BPJS KESEHATAN | EXCLUDE | Health insurance — out of scope |
| BPJS KETENAGAKERJAAN | EXCLUDE | Employment insurance — out of scope |
| BEA CUKAI, CUSTOMS | EXCLUDE | Customs duty (import PPN tracked separately) |
| IURAN BPJS | EXCLUDE | BPJS contribution |

### 3.3 Indonesian utilities (taxable at 11%)

**3.3 Indonesian utilities (taxable at 11%)**

| Pattern | Treatment | Rate | Notes |
| --- | --- | --- | --- |
| PLN, PERUSAHAAN LISTRIK NEGARA | Input 11% | 11% | Electricity — taxable |
| PDAM, AIR MINUM | EXEMPT | 0% | Drinking water supply — exempt |
| PERTAMINA | Input 11% | 11% | Fuel/gas — taxable |
| PERTAGAS, PGN (gas network) | Input 11% | 11% | Gas — taxable |
| TELKOM INDONESIA | Input 11% | 11% | Telecom — taxable |
| TELKOMSEL | Input 11% | 11% | Mobile — taxable |
| INDOSAT OOREDOO HUTCHISON | Input 11% | 11% | Mobile — taxable |
| XL AXIATA | Input 11% | 11% | Mobile — taxable |
| SMARTFREN | Input 11% | 11% | Mobile — t
---
name: au-payroll-tax
description: Panduan keahlian au-payroll-tax dari repo openaccountants/openaccountants
repo: openaccountants/openaccountants
license: MIT
---

# AU Payroll Tax

## Australia State and Territory Payroll Tax v1.0

> **General reference only.** This skill is general tax and accounting reference material for
> AI-assisted workflows. It has not been reviewed for any specific person's facts, documents,
> elections, deadlines, residency, filing status or local procedures. Do not rely on it to
> lodge, pay, amend or take a tax position without review by a qualified professional.

## Section 1 - Quick Reference

**Quick reference table**

| Field | Value |
| --- | --- |
| Country | Australia, all eight states and territories |
| Financial year covered | 2026-27 (1 July 2026 to 30 June 2027) |
| What is taxed | Taxable wages paid by an employer or group above the jurisdiction's threshold, self-assessed |
| Who administers it | Each state and territory revenue office; the ATO has no role |
| Harmonised areas | Return timing, motor vehicle and accommodation allowances, fringe benefits, work performed outside a jurisdiction, employee share schemes, super for non-working directors and grouping; WA aligned its provisions from 1 July 2012 |
| Registration trigger | Australia-wide taxable wages exceed the jurisdiction's monthly threshold |
| Monthly return | Due on the 7th of the following month |
| Annual return | Due 21 July, or 28 July in the ACT, NSW and SA |
| Annual thresholds 2026-27 | $1.0m in VIC and WA, $1.2m NSW, $1.25m TAS, $1.3m QLD, $1.5m SA, $1.75m ACT, $2.5m NT |
| Records | Keep for at least five years, in English, available on request |
| Reviewed by | Pending. Australian CPA or CA review required |

## Section 2 - The calculation workflow

**Step 1. Identify taxable wages.**
Wages is defined broadly: salary, allowances, bonuses, commissions, director's fees,
superannuation contributions, the grossed-up value of fringe benefits, employment termination
payments, shares and options, payments to contractors under relevant contracts and payments by
employment agents to on-hired workers. See Section 4.

**Step 2. Assign each employee's wages to a jurisdiction.**
Apply the nexus rules month by month. See Section 6.

**Step 3. Test grouping.**
Related corporations, common control, shared employees and traced interests form a group that
shares one threshold and is jointly and severally liable. See Section 7.

**Step 4. Work out the threshold or deduction.**
Apportion it for part-year employment and for the share of Australian wages paid in the
jurisdiction, then apply the jurisdiction's phase-out or diminishing formula. See Section 3 and
Section 5.

**Step 5. Apply the rate and any levy or surcharge.**
Queensland's mental health levy, Victoria's two surcharges and the higher rates for large
employers in the ACT and the NT all turn on Australia-wide wages. See Section 3.

**Step 6. Register, lodge and pay.**
Register in every jurisdiction where wages are paid once Australia-wide wages exceed its
threshold, lodge monthly by the 7th and reconcile annually by 21 July or 28 July. See Section 9.

## Section 3 - Rates and thresholds for 2026-27

**Rates and thresholds by jurisdiction**

| Jurisdiction | Annual threshold | Rate | How the threshold reduces | Levies and surcharges |
| --- | --- | --- | --- | --- |
| ACT | $1,750,000 (monthly $145,833.33) | 6.75% where Australia-wide wages are $20m or less, 6.85% to $50m, 7.35% to $100m, 7.85% to $150m and 8.75% above $150m | Apportioned by days employed and by the ACT share of Australia-wide wages; a group member that is not the DGE gets none | None; eligible ACT universities are capped at 6.85% |
| NSW | $1,200,000 | 5.45% | Apportioned by days employed and by the NSW share of Australian wages | None |
| NT | $2,500,000 (monthly $208,333) | 5.5%, or 6.5% for employers and group members with Australia-wide wages of $100m or more | Apportioned; confirm the current deduction rules with the Territory Revenue Office | None |
| QLD | $1,300,000 (monthly $108,333) | 4.75% where Australian wages are $6.5m or less, 4.95% above; regional employers get a 1% discount until 30 June 2030 | The deduction falls by $1 for every $7 of Australian wages above $1.3m and reaches nil at $10.4m | Mental health levy of 0.25% on Queensland wages where Australian wages exceed $10m, plus a further 0.5% above $100m |
| SA | $1,500,000 (monthly $125,000) | Variable from 0% to 4.95% where Australian wages exceed $1.5m but not $1.7m, then 4.95% | Maximum deduction $600,000 | None |
| TAS | $1,250,000 | 4% on the band from $1,250,001 to $2,000,000 and 6.1% on wages above $2,000,000 | Monthly threshold is the days in the month over the days in the year, multiplied by the annual amount | None |
| VIC | $1,000,000 (monthly $83,333) | 4.85%, or 1.2125% for regional employers | Full deduction where Australian wages are below $3m, phased out at 50 cents in the dollar between $3m and $5m, and nil above $5m; also apportioned by days and by the Victorian share | Mental health and wellbeing surcharge plus COVID-19 debt surcharge: a combined 1% on the Victorian share of wages above $10m Australian wages and 2% above $100m, until 30 June 2033 |
| WA | $1,000,000 (monthly $83,333) | 5.5% | The deduction falls by $2 for every $13 of Australian wages above $1m and reaches nil at $7.5m | None |

- **Where the figures come from** — The Payroll Tax Australia site lists every jurisdiction's current rate, threshold and deduction with a link to the revenue office page, and was last updated on 2 September 2026. Check it before relying on any figure above.  _([Payroll Tax Australia, Rates and thresholds](https://www.payrolltax.gov.au/harmonisation/payroll-tax-rates-and-thresholds))_
- **ACT tiers from 1 July 2026** — The rate depends on the group's Australia-wide wages, and the tax-free threshold is apportioned by the days wages were paid and by the ACT share of Australia-wide wages.  _([ACT Revenue Office, Calculating payroll tax](https://www.revenue.act.gov.au/business-taxes-and-levies/payroll-tax/calculating-payroll-tax))_
- **Northern Territory** — The threshold rose to $2.5m from 1 July 2025, and from 1 July 2026 a 6.5% rate applies to employers and group members with Australia-wide wages of $100m or more.  _([Territory Revenue Office, Payroll tax rates and thresholds](https://treasury.nt.gov.au/dtf/territory-revenue-office/payroll-tax/payroll-tax-rates-and-thresholds))_
- **Queensland deduction and levy** — The $1.3m deduction reduces by $1 for every $7 of Australian taxable wages above the threshold and is exhausted at $10.4m; only the designated group employer claims it, and it can nominate a member to receive any excess. The mental health levy applies proportionately to Queensland wages once the group's Australian wages pass $10m.  _([QRO, Payroll tax deductions](https://qro.qld.gov.au/payroll-tax/calculate/deductions/))_
- **Victorian phase-out** — An employer with Australian wages between $3m and $5m loses 50 cents of threshold for every dollar of wages above $3m (after apportionment), so a metropolitan employer paying $4.2m only in Victoria for a full year gets $400,000. Above $5m there is no threshold.  _([SRO Victoria, Threshold and phase-out rate](https://www.sro.vic.gov.au/businesses-and-organisations/payroll-tax/thresholds-and-grouping/threshold-and-phase-out-rate))_
- **Victorian surcharges** — The two surcharges are calculated on the same basis and only on the Victorian share of wages above the $10m and $100m thresholds; the COVID-19 debt surcharge runs to 30 June 2033.  _([SRO Victoria, Payroll tax current rates](https://www.sro.vic.gov.au/about-us/rates-and-statistics/current-rates/payroll-tax-current-rates))_
- **Western Australia** — The deductable amount is $1,000,000 less two-thirteenths of the wages above $1,000,000, so annual wages of $1,200,000 give a deduction of $969,231. Employers at $7.5m or more pay 5.5% on all WA wages.  _([WA Department of Treasury and Finance, Calculation](https://www.wa.gov.au/government/multi-step-guides/payroll-tax-employer-guide/calculation-payroll-tax-employer-guide))_
- **South Australia** — The rate is set by Australia-wide wages before the deduction is subtracted, rising from 0% at $1.5m to 4.95% at $1.7m, and the deduction is capped at $600,000. Exempt allowance rates for 2026-27 are 88 cents per kilometre and $328.85 per night.  _([RevenueSA, Rates and thresholds](https://www.revenuesa.sa.gov.au/payrolltax/rates-and-thresholds))_
- **Tasmania and NSW** — Tasmania publishes two rates and two thresholds for 2026-27 and an annual adjustment return guideline for part-year calculations; NSW publishes monthly thresholds of $92,055, $98,630 and $101,918 for 28-, 30- and 31-day months.  _([SRO Tasmania, Rates and thresholds](https://www.sro.tas.gov.au/payroll-tax/rates-thresholds))_

## Section 4 - Taxable wages, exemptions and allowances

- **Definition of wages** — The harmonised definition is not limited to salary. It covers remuneration, allowances, bonuses, commissions, director's fees, superannuation contributions, fringe benefits, shares and options, employment termination payments and deemed wages under the contractor and employment agency provisions.  _([Payroll Tax Australia, Definitions: wages](https://www.payrolltax.gov.au/definitions-acronyms-list/w))_
- **Termination payments** — An employment termination payment within s 82-130 ITAA 1997 that would be included in the employee's assessable income is wages, as is a payment that would be an ETP but for being made more than 12 months after termination. The tax-free component and the tax-free part of a genuine redundancy payment are not assessable and so are not wages, while accrued leave paid on termination is. See `au-employment-termination-payments.md`.  _([Payroll Tax Australia, Definitions: employment termination payment](https://www.payrolltax.gov.au/employment-termination-payment))_
- **Exempt allowances** — Under the harmonised ruling PTA 005 a motor vehicle allowance is exempt up to the ATO cents-per-kilometre rate for the previous income year (88 cents in 2026-27) and an accommodation allowance up to the ATO reasonable amount for the lowest capital city and lowest salary band for the current year ($328.85 per night in 2026-27). Anything above those rates is wages.  _([RevenueSA, Rates and thresholds](https://www.revenuesa.sa.gov.au/payrolltax/rates-and-thresholds))_
- **Fringe benefits** — Benefits that are fringe benefits under the FBT law are wages at their grossed-up value; each office publishes the gross-up rate to use and the option to declare the previous FBT year's figures.  _([Revenue NSW, Fringe benefits](https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/payroll-tax/taxable-wages/fringe-benefits))_
- **Common exemptions** — Each Act exempts particular wages, for example wages paid during maternity, paternity or adoption leave, workers compensation payments, and wages paid by certain charities for exempt work; some jurisdictions also exempt apprentices and trainees. The lists differ, so confirm each exemption on the relevant office's site before claiming it.  _([Payroll Tax Australia, Revenue rulings table](https://www.payrolltax.gov.au/revenue-rulings-table))_
- **Audit findings** — The revenue offices report the same errors year after year: omitted director's fees, super and fringe benefits; undeclared employee share scheme benefits; wrongly claimed exemptions; wages declared in the wrong jurisdiction; employees classified as contractors; and wrong grouping status.  _([Payroll Tax Australia, Lodging](https://www.payrolltax.gov.au/lodging))_

## Section 5 - Thresholds, deductions and apportionment

- **Part-year employment** — Multiply the annual threshold by the days wages were paid divided by the days in the financial year. In NSW an employer paying wages for 184 days of 2025-26 received $604,931.51.  _([Revenue NSW, Thresholds and rates](https://www.revenue.nsw.gov.au/taxes-duties-levies-royalties/payroll-tax/lodge-and-pay-returns/thresholds-and-rates))_
- **Interstate wages** — Multi
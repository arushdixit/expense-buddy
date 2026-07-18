# 📌 CONSTRAINTS — Single Source of Truth
> Always read this file before doing any analysis. Do NOT re-derive constraints from conversation history.
> Last updated: 2026-06-12

---

## SECTION A: Situational Constraints (Her Travel Setup)

### A1. Flight Booking
- ❌ Flights are booked and paid **directly by the company**
- ✅ Flights **never appear on her personal credit card**
- → Do NOT model flight cashback as a benefit (she has no spend here)

### A2. Hotel Booking & Payment
- ✅ Hotels are booked by the company but **paid by her personal credit card at hotel reception**
- ✅ Paying at reception = **MCC 7011 (Hotels/Lodging) guaranteed** — no OTA MCC risk
- ✅ The full hotel bill goes on her card first, then company reimburses her
- → Hotel spend IS on her card → earns rewards → cashback/points are hers to keep
- → Reimbursement does NOT take back the cashback

### A3. Food During Travel
- ✅ Food expenses during international trips are **paid by her personal card**
- ✅ Company **reimburses food costs** after the fact
- → Food spend IS on her card → earns rewards
- → Reimbursement does NOT take back the cashback

### A4. Forex Fees on Reimbursed Items
- ✅ Company reimburses **hotel + food including the forex fees** charged on those transactions
- → Forex fee on hotel and food = effectively zero net cost to her
- → Do NOT count forex fee savings as a personal benefit for hotel/food categories
- → Forex fee savings only matter for **personal, non-reimbursed** spend abroad

### A5. Non-Reimbursed Personal Spend Abroad
- ❌ The following are **NOT reimbursed** by the company — purely personal cost:
  - Shopping (clothes, bags, retail)
  - Sightseeing / entry tickets
  - Local transport (metro, taxi, Uber abroad)
  - Personal snacks / 7-Eleven etc.
- → For these, forex fee IS a real cost to her
- → All cards net negative internationally on personal spend due to forex fees
- → ADCB Traveller (0% forex, 0% cashback) = net zero = least bad option

### A6. Travel Volume
- **Base scenario:** 4 trips/year (~40 nights)
- **High scenario:** 6 trips/year (~60 nights)
- **Observed trips:** Paris (Feb 2026, ~5 nights), Boston (May–Jun 2026, ~12 nights)
- **Hotel spend observed:** Paris AED 6,610 | Boston AED 23,165 (split across 2 billing months)
- **Billing split pattern:** Long stays may split across 2 calendar months (e.g. Boston charged May 30 + June 1)

---

## SECTION B: Loyalty Status

| Program | Current Status | Notes |
|---|---|---|
| Emirates Skywards | **Gold** | 56,000+ miles. Flights booked by company — miles may accrue to her Skywards account |
| Marriott Bonvoy | **Silver** | Will reach **Gold naturally** through consulting stays. Gold status is NOT a deciding factor for card choice — do not count it as a card benefit |

---

## SECTION C: Existing Cards (Already Held, Free)

| Card | Annual Fee | Keep? |
|---|---|---|
| **HSBC Cash+** | Free | ✅ Yes — universal fallback |
| **Noon One ENBD** | Free | ✅ Yes — 20% noon Food, 5% noon.com |

---

## SECTION D: Card Acquisition Rules

- ✅ **Free cards:** No limit — can hold as many as useful
- ✅ **Paid cards:** Maximum **1 paid card** acceptable
- ❌ **ADCB 365:** Excluded from consideration (AED 5k/month minimum unreliable for her spend profile)
- ❌ **FAB Travel:** Excluded (AED 25k/month min salary, complex terms)

---

## SECTION E: Card Constraint Database

### E1. SIB Cashback Covered Card

| Attribute | Value |
|---|---|
| Annual Fee | AED 0 yr1 / AED 199 yr2 (waived if annual spend ≥ AED 10,000) |
| Effective fee | ✅ Free |
| **10% cashback** | Online purchases + Apple Pay / Samsung Wallet |
| 10% Monthly cap | ⚠️ AED 300/month = max AED 3,000 qualifying spend/month |
| 10% Exclusions | Supermarkets, hypermarkets (e.g. Carrefour), utilities (DEWA), telecom (e&, du), government services, education — **even if paid via Apple Pay** (MCC-based, not payment-method-based) |
| **2% cashback** | International retail (foreign currency transactions) — unlimited, no cap |
| **1% cashback** | Domestic retail (AED transactions) — unlimited |
| **0.5% cashback** | Utilities, telecom, govt, supermarkets, education |
| Monthly minimum | None |
| Forex fee | 2.5% |
| Best for | First AED 3,000/month of: dining (restaurants), Careem, Deliveroo, Amazon, general online retail, clothing apps — via Apple Pay |
| Avoid using for | Carrefour (0.5%), DEWA (0.5%), government payments (0.5%), international spend (2.5% forex kills the 2% gain) |

---

### E2. ENBD SHARE Visa Signature

| Attribute | Value |
|---|---|
| Annual Fee | ✅ Free for Life |
| **6% SHARE Points** | MAF ecosystem: Carrefour (in-store + online), City Centre malls, Mall of the Emirates, VOX Cinemas, restaurants within MAF malls, and 5,000+ MAF partner locations |
| Monthly cap | 50,000 pts/month = AED 5,000 cashback equivalent — practically never hit at normal spend |
| Non-MAF spend | 0.25% (negligible) |
| Govt / utilities | 0.10% (negligible) |
| Monthly minimum | None |
| Forex fee | 2.5% |
| Best for | All Carrefour grocery, City Centre / MoE mall shopping, VOX Cinemas |
| Avoid using for | Anything not MAF-coded, international spend |

---

### E3. Noon One ENBD Visa

| Attribute | Value |
|---|---|
| Annual Fee | ✅ Lifetime Free |
| **20% cashback** | noon Food orders |
| **10% cashback** | NowNow (quick commerce) |
| **5% cashback** | noon.com, Namshi, SIVVI, Supermall |
| **1% cashback** | All other retail |
| Monthly cap | ⚠️ AED 2,000/month total noon Credits across all tiers |
| Monthly minimum | None |
| Forex fee | 3.25–3.69% |
| Best for | All noon ecosystem spend (food delivery, online shopping) |
| Avoid using for | Anything international (very high forex fee) |

---

### E4. HSBC Cash+

| Attribute | Value |
|---|---|
| Annual Fee | ✅ Free |
| **~1.1% cashback** | All eligible spend (1% base + 10% bonus on cashback earned) |
| Monthly cap | None |
| Monthly minimum | None |
| Forex fee | ~3.14% (1% network + ~2.14% bank fee) |
| Best for | DEWA, telecom (e&, du), government payments, RTA, residual domestic spend — anything with no better option |
| Avoid using for | International spend (3.14% forex destroys returns) |

---

### E5. ADCB Traveller ← THE ONE PAID CARD

| Attribute | Value |
|---|---|
| Annual Fee | ❌ AED 1,575/year |
| **10% cashback** | Hotels (MCC 7011) + Airlines — **she pays at reception → MCC 7011 guaranteed ✅** |
| **0% cashback** | ALL other international spend (non-hotel, non-airline) — 0% cashback, but 0% forex |
| **1.5% cashback** | Domestic AED retail spend only |
| Monthly minimum | ⚠️ AED 5,000/month — zero cashback if not met in that calendar month |
| Monthly cap | ⚠️ AED 1,500/month (= max AED 15,000 hotel spend earns 10%) |
| Forex fee | ✅ 0% |
| When minimum is met | Travel months: ✅ easily met (hotel bill alone exceeds AED 5,000) |
| When minimum is NOT met | Non-travel months: ⚠️ domestic spend ~AED 3,700 < AED 5,000 → zero cashback on domestic |
| Welcome bonus | AED 2,000 Expedia hotel voucher (spend AED 15k in first 60 days — easily met with first hotel charge) |
| Other perks | 14 lounge visits/year, 4 Careem airport rides/year |
| Best for | ALL international spend: hotel (10% cashback), food abroad (0% cashback but 0% forex), shopping abroad (0% cashback but 0% forex) |
| NOT useful for | Domestic non-travel months (min spend not met), airline tickets (company pays) |

---

### E6. Marriott Bonvoy World Mastercard (ENBD) ← OPTIONAL

| Attribute | Value |
|---|---|
| Annual Fee | ❌ AED 315/year |
| **~2.1% return** | Marriott Bonvoy hotels (3 pts/USD × AED 0.026/pt) |
| **~1.05% return** | All other retail (1.5 pts/USD) |
| Low earning | Groceries, supermarkets, utilities, education, telecom, insurance: 0.3–0.75 pts/USD |
| Monthly cap | None on standard earnings |
| Monthly minimum | None |
| Auto elite nights | 10 elite night credits/year (credited regardless of stays) |
| Free night award | 50,000-pt certificate on annual renewal (value ~AED 1,200 at mid/upscale Marriott) |
| Forex fee | 2.5% |
| Net value (no Gold needed) | AED 1,200 free night − AED 315 fee = **+AED 885/year guaranteed** |
| Gold status | ⚠️ NOT a factor — she reaches Gold naturally through consulting stays |
| Best for | Free night redemption value. Minimal spend routing needed. |
| Decision rule | Worth it purely for the AED 885 net from free night, IF she will reliably redeem the free night award each year |

---

## SECTION F: Key Formulas

### F1. International Hotel (Reimbursed — incl. forex)

```
Net return = Cashback rate only (forex on hotel is reimbursed by company)

ADCB Traveller hotel:   10% cashback − 0% forex = +10% net ✅ WINNER
Marriott (at Marriott): 2.1% cashback − 2.5% forex (reimbursed) = +2.1% net
HSBC:                   1.1% cashback − 3.14% forex (reimbursed) = +1.1% net
SIB:                    2% cashback − 2.5% forex (reimbursed) = +2% net
```

> → **ADCB Traveller wins decisively at +10%.**
> → She pays at hotel reception → MCC 7011 guaranteed → 10% cashback applies.
> → The reimbursement includes forex fees → net cost of forex = zero.

---

### F2. International Food (Reimbursed — incl. forex)

> ⚠️ **This category is different from personal shopping abroad.**
> Food forex is reimbursed by the company → the forex fee does NOT reduce her net return.
> Therefore: Net return = Cashback rate only. Best card = highest cashback rate.

```
Net return = Cashback rate only (forex on food is reimbursed — irrelevant)

SIB (via Apple Pay, if cap available): 10% cashback → net +10% ✅ BEST (within AED 300/month cap)
SIB international retail (no cap):     2% cashback  → net +2%  ✅ GOOD
HSBC:                                  1.1% cashback → net +1.1%
Marriott:                              1.05% cashback → net +1.05%
ADCB Traveller non-hotel:             0% cashback   → net 0%   ❌ WORST for food
```

> → **SIB is the best card for international food** — not ADCB Traveller.
> → ADCB Traveller earns 0% on non-hotel international transactions.
> → Use SIB for restaurant meals abroad if Apple Pay cap is available, otherwise SIB 2% flat, otherwise HSBC 1.1%.
> → **Practical rule:** Carry SIB card on trips. Use it for restaurant payments (Apple Pay). Use ADCB Traveller only at hotel reception.
>
> **SIB cap awareness in travel months:** The AED 300/month (= AED 3,000 spend) cap is shared across domestic + international 10% eligible spend. If the cap is already used up on domestic spend in the same calendar month, international food falls to SIB's 2% flat rate — still better than ADCB's 0%.

---

### F3. Personal Shopping / Sightseeing / Transport Abroad (NOT reimbursed)

> ⚠️ This is personal spend — company does NOT reimburse. Forex is a real cost.
> Net return = Cashback rate − Forex fee.

```
Net return = Cashback rate − Forex fee (NOT reimbursed)

ADCB Traveller non-hotel:  0% − 0% forex   = 0% net  ✅ LEAST BAD
SIB international retail:  2% − 2.5% forex = −0.5% net loss
Marriott:                  1.05% − 2.5%    = −1.45% net loss
HSBC:                      1.1% − 3.14%    = −2.04% net loss
```

> → **ADCB Traveller is the best card for personal shopping abroad** — not because it earns anything, but because it costs nothing (0% forex).
> → Every other card results in a net loss on personal international spend.
> → Practical rule: use ADCB Traveller as the default card for all non-food, non-hotel spend abroad.

### Monthly SIB slot

```
SIB 10% cap = AED 300/month
Qualifying spend to fill cap = AED 3,000/month
Typical eligible spend (dining + Careem + Amazon + online retail) = ~AED 1,100–1,500/month
Unused SIB capacity = ~AED 1,500–1,900/month → opportunity to increase eligible spend
```

### ADCB Traveller break-even vs doing nothing

```
Annual hotel spend needed to cover AED 1,575 fee:
AED 1,575 ÷ 10% = AED 15,750/year minimum hotel spend

Her actual hotel spend: ~AED 52,000/year (base) → covers fee 3.3× over
```

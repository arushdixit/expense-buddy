"""
test_parser.py — Compare new parse_statements.py output against backup CSV.

Runs parse_pdf() on every statement PDF and checks:
  1. Total transaction count vs backup
  2. Amount totals by month
  3. Per-transaction amount matching (by date + rounded amount)
  4. Category distribution comparison

Usage:
    python scripts/test_parser.py
"""

import os
import sys
import json
import csv
from collections import defaultdict

# Add scripts/ to path so parse_statements is importable
_root = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, _root)

from parse_statements import parse_pdf

STATEMENTS_DIR = os.path.join(_root, "..", "statements", "Training Data")
BACKUP_CSV = os.path.join(_root, "..", "backup", "expenses_rows.csv")

# ── Load backup CSV ──────────────────────────────────────────────────────────

def load_backup():
    rows = []
    with open(BACKUP_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                amount = float(row["amount"])
            except (ValueError, KeyError):
                continue
            rows.append({
                "date": row["date"][:10],  # YYYY-MM-DD
                "amount": amount,
                "category": row.get("category", ""),
                "subcategory": row.get("subcategory", ""),
            })
    return rows

# ── Run parser on all PDFs ───────────────────────────────────────────────────

def load_parsed():
    all_txs = []
    for filename in sorted(os.listdir(STATEMENTS_DIR)):
        if filename.endswith(".pdf") and filename != "Account summary and transactions.pdf":
            pdf_path = os.path.join(STATEMENTS_DIR, filename)
            print(f"  Parsing: {filename}")
            try:
                txs = parse_pdf(pdf_path)
                print(f"    → {len(txs)} transactions")
                all_txs.extend(txs)
            except Exception as e:
                print(f"    ✗ FAILED: {e}")
    return all_txs

# ── Helpers ──────────────────────────────────────────────────────────────────

def month_key(date_str):
    return date_str[:7]  # YYYY-MM

def bucket_by_month(txs, amount_key="amount"):
    buckets = defaultdict(list)
    for tx in txs:
        buckets[month_key(tx["date"])].append(round(tx[amount_key], 2))
    return buckets

def category_counts(txs):
    counts = defaultdict(int)
    for tx in txs:
        counts[tx["category"]] += 1
    return dict(sorted(counts.items()))

# ── Main comparison ──────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("Loading backup CSV …")
    backup = load_backup()
    print(f"  Backup rows: {len(backup)}")

    print("\nRunning parser on PDFs …")
    parsed = load_parsed()
    print(f"  Parsed total: {len(parsed)}")

    # ── 1. Count comparison ─────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("1. TRANSACTION COUNT COMPARISON")
    print(f"   Backup : {len(backup)}")
    print(f"   Parsed : {len(parsed)}")
    diff = len(parsed) - len(backup)
    print(f"   Diff   : {diff:+d}")

    # ── 2. Monthly totals ───────────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("2. MONTHLY AMOUNT TOTALS")
    b_months = defaultdict(float)
    for tx in backup:
        b_months[month_key(tx["date"])] += tx["amount"]

    p_months = defaultdict(float)
    for tx in parsed:
        p_months[month_key(tx["date"])] += tx["amount"]

    all_months = sorted(set(b_months) | set(p_months))
    print(f"  {'Month':<10} {'Backup':>12} {'Parsed':>12} {'Diff':>12}")
    print("  " + "-" * 50)
    for m in all_months:
        b = round(b_months.get(m, 0), 2)
        p = round(p_months.get(m, 0), 2)
        d = round(p - b, 2)
        flag = " ← MISMATCH" if abs(d) > 10 else ""
        print(f"  {m:<10} {b:>12.2f} {p:>12.2f} {d:>+12.2f}{flag}")

    # ── 3. Amount matching (fuzzy, by date bucket) ──────────────────────────
    print("\n" + "=" * 60)
    print("3. AMOUNT MATCHING (by date, ±0.01)")
    b_by_date = defaultdict(list)
    for tx in backup:
        b_by_date[tx["date"]].append(round(abs(tx["amount"]), 2))

    p_by_date = defaultdict(list)
    for tx in parsed:
        p_by_date[tx["date"]].append(round(abs(tx["amount"]), 2))

    matched = 0
    unmatched_parsed = []
    for date, amounts in sorted(p_by_date.items()):
        b_amounts = sorted(b_by_date.get(date, []))
        p_amounts = sorted(amounts)
        for amt in p_amounts:
            if amt in b_amounts:
                b_amounts.remove(amt)
                matched += 1
            else:
                unmatched_parsed.append((date, amt))

    match_pct = 100 * matched / len(parsed) if parsed else 0
    print(f"  Matched  : {matched}/{len(parsed)}  ({match_pct:.1f}%)")
    if unmatched_parsed:
        print(f"  Unmatched parsed transactions ({len(unmatched_parsed)}):")
        for date, amt in unmatched_parsed[:20]:
            print(f"    {date}  AED {amt:.2f}")
        if len(unmatched_parsed) > 20:
            print(f"    … and {len(unmatched_parsed) - 20} more")

    # ── 4. Category distribution ────────────────────────────────────────────
    print("\n" + "=" * 60)
    print("4. CATEGORY DISTRIBUTION COMPARISON")
    b_cats = category_counts(backup)
    p_cats = category_counts(parsed)
    all_cats = sorted(set(b_cats) | set(p_cats))
    print(f"  {'Category':<20} {'Backup':>8} {'Parsed':>8} {'Diff':>8}")
    print("  " + "-" * 48)
    for cat in all_cats:
        b = b_cats.get(cat, 0)
        p = p_cats.get(cat, 0)
        d = p - b
        flag = " ←" if d != 0 else ""
        print(f"  {cat:<20} {b:>8} {p:>8} {d:>+8}{flag}")

    # ── 5. Save parsed JSON for manual inspection ───────────────────────────
    out_path = os.path.join(_root, "test_output.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(parsed, f, indent=2, ensure_ascii=False)
    print(f"\n✓ Full parsed output saved to: {out_path}")
    print("=" * 60)

if __name__ == "__main__":
    main()

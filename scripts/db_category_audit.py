"""
db_category_audit.py
====================
Audits how well categorize() agrees with your hand-labelled Supabase backup.

Strategy:
  1. Parse every PDF in /statements using parse_pdf() → get (date, amount, description, predicted_cat, predicted_sub)
  2. Load expenses_rows.csv → (date, amount, category, subcategory)
  3. For each parsed transaction, find the best CSV match by amount (±0.05) and date (±2 days)
  4. Compare predicted cat/sub vs CSV cat/sub and report mismatches

Usage:
    python3 scripts/db_category_audit.py
"""

import os
import sys
import json
import csv
from datetime import datetime, timedelta

BASE_DIR       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
STATEMENTS_DIR = os.path.join(BASE_DIR, "statements")
DB_CSV_PATH    = os.path.join(BASE_DIR, "backup", "expenses_rows.csv")

sys.path.insert(0, os.path.join(BASE_DIR, "scripts"))
from parse_statements import parse_pdf


# --------------------------------------------------------------------------
# Load CSV
# --------------------------------------------------------------------------
def load_db_expenses(csv_path):
    """
    Returns list of {date, amount, category, subcategory}.
    Columns: id, amount, category, subcategory, date, note, ...
    """
    expenses = []
    if not os.path.exists(csv_path):
        print(f"[ERROR] CSV not found: {csv_path}")
        return expenses

    with open(csv_path, newline="", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                amt = float(row.get("amount") or 0)
                cat = (row.get("category") or "").strip()
                sub = (row.get("subcategory") or "").strip() or None
                date_str = (row.get("date") or "").strip()
                if cat and date_str:
                    expenses.append({
                        "amount": amt,
                        "category": cat,
                        "subcategory": sub or "",
                        "date": date_str,
                    })
            except (ValueError, KeyError):
                continue
    return expenses


# --------------------------------------------------------------------------
# Matching
# --------------------------------------------------------------------------
def find_csv_match(tx_date_str, tx_amt, db_expenses, used_indices):
    """Find the best CSV row matching by date (±2 days) and amount (±0.05)."""
    try:
        tx_date = datetime.strptime(tx_date_str, "%Y-%m-%d")
    except ValueError:
        return None, None

    tx_abs = abs(tx_amt)
    best_idx, best_diff = None, 999

    for i, exp in enumerate(db_expenses):
        if i in used_indices:
            continue
        if abs(abs(exp["amount"]) - tx_abs) > 0.05:
            continue
        try:
            db_date = datetime.strptime(exp["date"], "%Y-%m-%d")
        except ValueError:
            continue
        diff = abs((db_date - tx_date).days)
        if diff <= 2 and diff < best_diff:
            best_diff = diff
            best_idx = i

    if best_idx is None:
        return None, None
    return db_expenses[best_idx], best_idx


# --------------------------------------------------------------------------
# Audit
# --------------------------------------------------------------------------
def run_audit(db_expenses):
    pdf_files = [
        f for f in sorted(os.listdir(STATEMENTS_DIR))
        if f.endswith(".pdf") and f != "Account summary and transactions.pdf"
    ]

    if not pdf_files:
        print(f"[ERROR] No PDF files found in {STATEMENTS_DIR}")
        return

    print(f"\nFound {len(pdf_files)} PDF statement(s) to parse.\n")

    all_transactions = []
    for fname in pdf_files:
        pdf_path = os.path.join(STATEMENTS_DIR, fname)
        print(f"  Parsing: {fname}...", end=" ", flush=True)
        try:
            txs = parse_pdf(pdf_path)
            print(f"{len(txs)} transactions")
            for tx in txs:
                tx["_source_file"] = fname
            all_transactions.extend(txs)
        except Exception as e:
            print(f"ERROR: {e}")

    print(f"\nTotal parsed transactions : {len(all_transactions)}")
    print(f"Total DB CSV rows         : {len(db_expenses)}\n")

    matched   = []
    unmatched = []
    used_db_indices = set()

    for tx in all_transactions:
        db_exp, db_idx = find_csv_match(tx["date"], tx["amount"], db_expenses, used_db_indices)
        if db_exp is None:
            unmatched.append(tx)
            continue
        used_db_indices.add(db_idx)
        matched.append((tx, db_exp))

    # Compare categories
    agree     = []
    disagree  = []
    for tx, db_exp in matched:
        pred_cat = tx["category"]
        pred_sub = tx["subcategory"]
        db_cat   = db_exp["category"]
        db_sub   = db_exp["subcategory"]

        cat_ok = pred_cat.lower() == db_cat.lower()
        sub_ok = pred_sub.lower() == db_sub.lower() if db_sub else True

        if cat_ok and sub_ok:
            agree.append((tx, db_exp))
        else:
            disagree.append((tx, db_exp))

    total_matched = len(matched)
    pct = 100 * len(agree) / total_matched if total_matched else 0

    print("=" * 70)
    print(f"  Matched to CSV        : {total_matched} / {len(all_transactions)}")
    print(f"  Unmatched (no CSV row): {len(unmatched)}")
    print(f"  Category agrees       : {len(agree)}  ({pct:.1f}%)")
    print(f"  Category disagrees    : {len(disagree)}")
    print("=" * 70)

    if disagree:
        print("\n--- Category Mismatches ---")
        print(f"{'Date':<12} {'Amount':>8}  {'Description':<45}  {'DB cat/sub':<28}  Predicted")
        print("-" * 120)
        for tx, db_exp in disagree:
            db_label   = f"{db_exp['category']}/{db_exp['subcategory'] or '—'}"
            pred_label = f"{tx['category']}/{tx['subcategory']}"
            desc_trunc = tx['description'][:44]
            print(f"{tx['date']:<12} {tx['amount']:>8.2f}  {desc_trunc:<45}  {db_label:<28}  {pred_label}")

    if unmatched:
        print(f"\n--- {len(unmatched)} parsed transactions with no CSV match (new / not in DB) ---")
        print(f"{'Date':<12} {'Amount':>8}  {'Description':<45}  Predicted")
        print("-" * 80)
        for tx in unmatched[:30]:  # cap at 30 to avoid wall of text
            print(f"{tx['date']:<12} {tx['amount']:>8.2f}  {tx['description'][:44]:<45}  {tx['category']}/{tx['subcategory']}")
        if len(unmatched) > 30:
            print(f"  ... and {len(unmatched)-30} more.")


if __name__ == "__main__":
    print(f"Loading DB backup from : {DB_CSV_PATH}")
    db_expenses = load_db_expenses(DB_CSV_PATH)
    print(f"Loaded {len(db_expenses)} CSV rows.")
    run_audit(db_expenses)

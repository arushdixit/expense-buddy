"""
verify_categories.py

Performs a complete comparison between:
1. Production expenses (backup/expenses_rows.csv)
2. Backup queue expenses (backup/expenses_backup_rows.csv)

Matches rows by Amount, Category, and Subcategory ONLY.
It links categories using backup/categories_rows.csv for custom category UUID matching.
"""

import os
import csv
import sys

def load_categories(categories_csv):
    categories = {}
    if not os.path.exists(categories_csv):
        return categories
    with open(categories_csv, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            categories[row['id']] = row['name']
    return categories

def clean_category(cat_str, categories_map):
    if cat_str in categories_map:
        return categories_map[cat_str]
    return cat_str

def main():
    backup_dir = "/Users/arushdixit/Downloads/AI Project/expense-buddy/backup"
    expenses_csv = os.path.join(backup_dir, "expenses_rows.csv")
    backup_expenses_csv = os.path.join(backup_dir, "expenses_backup_rows.csv")
    categories_csv = os.path.join(backup_dir, "categories_rows.csv")

    if not os.path.exists(backup_expenses_csv):
        print(f"Error: Could not find '{backup_expenses_csv}'.")
        print("Please copy your supabase `expenses_backup` table CSV export to that path first.")
        sys.exit(1)

    categories_map = load_categories(categories_csv)
    
    # Parse production expenses (expenses_rows.csv)
    prod_expenses = []
    with open(expenses_csv, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            prod_expenses.append({
                'id': row['id'],
                'amount': float(row['amount']),
                'category': clean_category(row['category'], categories_map),
                'subcategory': row['subcategory'] or '',
                'date': row['date'],
                'note': row['note'] or ''
            })

    # Parse backup expenses (expenses_backup_rows.csv)
    backup_expenses = []
    with open(backup_expenses_csv, mode='r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            backup_expenses.append({
                'id': row['id'],
                'amount': float(row['amount']),
                'category': clean_category(row['category'], categories_map),
                'subcategory': row['subcategory'] or '',
                'date': row['date'],
                'note': row['note'] or ''
            })

    print(f"Loaded {len(prod_expenses)} production expenses.")
    print(f"Loaded {len(backup_expenses)} backup queue expenses.\n")
    
    print("=" * 100)
    print(f"{'Backup Date':<12} | {'Amount':<10} | {'Backup Cat/Sub':<30} | {'Prod Date':<12} | {'Prod Note/Details':<30}")
    print("=" * 100)

    matched_count = 0
    
    for be in backup_expenses:
        # Match candidates by Amount, Category, and Subcategory ONLY
        candidates = []
        for pe in prod_expenses:
            if abs(pe['amount'] - be['amount']) < 0.01:
                if pe['category'].lower() == be['category'].lower():
                    # Match subcategory case insensitively
                    if pe['subcategory'].lower() == be['subcategory'].lower():
                        candidates.append(pe)
        
        be_display = f"{be['category']}/{be['subcategory']}" if be['subcategory'] else be['category']
        
        if not candidates:
            print(f"{be['date']:<12} | {be['amount']:<10.2f} | {be_display:<30} | {'[NO MATCH]':<12} | {'NOT FOUND IN PRODUCTION':<30} | ❓ UNMATCHED")
        else:
            matched_count += 1
            # If multiple matching candidates exist, show them
            best_cand = candidates[0]
            print(f"{be['date']:<12} | {be['amount']:<10.2f} | {be_display:<30} | {best_cand['date']:<12} | {best_cand['note'][:30]:<30} | ✅ MATCHED ({len(candidates)} candidate(s))")
            if len(candidates) > 1:
                for alt in candidates[1:]:
                    print(f"{'':<12} | {'':<10} | {'':<30} | {alt['date']:<12} | {alt['note'][:30]:<30} | (alternative)")

    print("=" * 100)
    print(f"Total backup items evaluated: {len(backup_expenses)}")
    print(f"Total matched (by Amount + Category + Subcategory): {matched_count}")
    print(f"Unmatched transactions: {len(backup_expenses) - matched_count}")

if __name__ == '__main__':
    main()

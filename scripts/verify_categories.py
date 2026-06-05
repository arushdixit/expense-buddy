"""
verify_categories.py

Performs a complete comparison between:
1. Production expenses (backup/expenses_rows.csv)
2. Backup queue expenses (backup/expenses_backup_rows.csv)

It links categories using backup/categories_rows.csv for custom category UUID matching.
Verifies all fields: Date, Amount, Category, Subcategory, Notes, Household, and User alignment.
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
                'note': row['note'] or '',
                'user_id': row.get('user_id', '') or '',
                'household_id': row.get('household_id', '') or ''
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
                'note': row['note'] or '',
                'user_id': row.get('user_id', '') or '',
                'household_id': row.get('household_id', '') or ''
            })

    print(f"Loaded {len(prod_expenses)} production expenses.")
    print(f"Loaded {len(backup_expenses)} backup queue expenses.\n")
    
    print("=" * 100)
    print(f"{'Date':<12} | {'Amount':<10} | {'Field':<15} | {'Backup Value':<30} | {'Production Value':<30}")
    print("=" * 100)

    matched_count = 0
    full_matches = 0
    mismatches = 0
    
    for be in backup_expenses:
        # Match candidates by exact date and amount
        candidates = [pe for pe in prod_expenses if pe['date'] == be['date'] and abs(pe['amount'] - be['amount']) < 0.01]
        
        if not candidates:
            print(f"{be['date']:<12} | {be['amount']:<10.2f} | {'[MATCH STATUS]':<15} | {'Exists in Backup Queue':<30} | {'NOT FOUND IN PRODUCTION':<30} | ❓ UNMATCHED")
            continue
            
        matched_count += 1
        
        # We compare against the best candidate (if multiple exist, find one with matching category, else take first)
        best_cand = candidates[0]
        for cand in candidates:
            if cand['category'].lower() == be['category'].lower():
                best_cand = cand
                break
        
        # Detailed field-by-field verification
        fields_to_compare = [
            ('category', 'Category'),
            ('subcategory', 'Subcategory'),
            ('note', 'Note/Details'),
            ('user_id', 'User ID'),
            ('household_id', 'Household ID')
        ]
        
        has_field_mismatch = False
        mismatched_fields_log = []
        
        for field_key, field_name in fields_to_compare:
            b_val = be[field_key]
            p_val = best_cand[field_key]
            
            # Normalize notes for statement comparison differences
            if field_key == 'note':
                # Strip the enclosing "Imported from Statement (...)" from backup notes if present to match clean values
                b_val_clean = b_val.replace("Imported from Statement (", "").replace(")", "").strip()
                p_val_clean = p_val.replace("Imported from Statement (", "").replace(")", "").strip()
                if b_val_clean.lower() != p_val_clean.lower():
                    has_field_mismatch = True
                    mismatched_fields_log.append((field_name, b_val, p_val))
            else:
                if str(b_val).lower().strip() != str(p_val).lower().strip():
                    has_field_mismatch = True
                    mismatched_fields_log.append((field_name, b_val, p_val))
        
        if not has_field_mismatch:
            full_matches += 1
            print(f"{be['date']:<12} | {be['amount']:<10.2f} | {'[ALL FIELDS]':<15} | {f'{be['category']}/{be['subcategory']}':<30} | {f'{best_cand['category']}/{best_cand['subcategory']}':<30} | ✅ PERFECT MATCH")
        else:
            mismatches += 1
            print(f"{be['date']:<12} | {be['amount']:<10.2f} | {'[MISMATCH]':<15} | {f'{be['category']}/{be['subcategory']}':<30} | {f'{best_cand['category']}/{best_cand['subcategory']}':<30} | ❌ FIELD MISMATCH")
            for field_name, b_val, p_val in mismatched_fields_log:
                print(f"{'':<12} | {'':<10} |   -> {field_name:<11} | {str(b_val):<30} | {str(p_val):<30}")
            print("-" * 100)

    print("=" * 100)
    print(f"Total backup items evaluated: {len(backup_expenses)}")
    print(f"Total matched (by date & amount): {matched_count}")
    print(f"  - Fully Aligned (All fields match): {full_matches}")
    print(f"  - Mismatched fields: {mismatches}")
    print(f"  - Unmatched transactions: {len(backup_expenses) - matched_count}")

if __name__ == '__main__':
    main()

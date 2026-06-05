import os
import re
import json
import hashlib
from datetime import datetime
from pypdf import PdfReader

# Load Categories and Subcategories Lookup Table
lookup_path = "/Users/arushdixit/Downloads/AI Project/expense-buddy/src/lib/categories_subcategories.json"
if os.path.exists(lookup_path):
    with open(lookup_path, 'r', encoding='utf-8') as f:
        TAXONOMY = json.load(f)
else:
    TAXONOMY = {}

def split_concatenated_lines(line):
    style_a_pattern = r'(-?\d{1,2}-[A-Za-z]{3}-\d{2,4}\s+\d{1,2}-[A-Za-z]{3}-\d{2,4})'
    style_b_pattern = r'(-?\d{2}/\d{2}/\d{4})'
    
    matches = list(re.finditer(style_a_pattern, line))
    if not matches:
        matches = list(re.finditer(style_b_pattern, line))
        
    if len(matches) <= 1:
        return [line]
        
    sub_lines = []
    # If there's content before the first date match, preserve it as a leading segment
    if matches[0].start() > 0:
        leading = line[:matches[0].start()].strip()
        if leading:
            sub_lines.append(leading)
    for i in range(len(matches)):
        start = matches[i].start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        sub_lines.append(line[start:end].strip())
    return sub_lines


def clean_amount(amt_str):
    amt_str = amt_str.replace(',', '').strip()
    is_credit = False
    if amt_str.endswith('CR'):
        is_credit = True
        amt_str = amt_str[:-2].strip()
    try:
        val = float(amt_str)
        if is_credit:
            return -val, True
        else:
            return val, False
    except ValueError:
        return None, False

def parse_date_a(date_str):
    parts = date_str.split('-')
    if len(parts) != 3:
        return None
    day = parts[0].zfill(2)
    month_str = parts[1].lower()
    year_str = parts[2]
    
    months = {
        'jan': '01', 'feb': '02', 'mar': '03', 'apr': '04', 'may': '05', 'jun': '06',
        'jul': '07', 'aug': '08', 'sep': '09', 'oct': '10', 'nov': '11', 'dec': '12'
    }
    month = months.get(month_str[:3])
    if not month:
        return None
        
    if len(year_str) == 2:
        year = "20" + year_str
    else:
        year = year_str
    return f"{year}-{month}-{day}"

def parse_date_b(date_str):
    parts = date_str.split('/')
    if len(parts) != 3:
        return None
    day = parts[0].zfill(2)
    month = parts[1].zfill(2)
    year = parts[2]
    return f"{year}-{month}-{day}"

def categorize(desc, amt, is_refund, is_foreign=False):
    desc_lower = desc.lower().strip()
    
    # General overrides
    if "mbta" in desc_lower:
        return "Travel", "Transit"
    if "vfs" in desc_lower:
        return "Travel", "Visa"
        
    # Defaults
    category = "Shopping"
    subcategory = "Miscellaneous"
    
    # --- FOREIGN / TRAVEL CATEGORY FORCE ---
    if is_foreign:
        category = "Travel"
        if any(x in desc_lower for x in ["hotel", "resort", "villa", "stay", "suites", "ritz", "marriott", "hilton", "hyatt", "renaissance", "sala samui", "airbnb", "hostel", "lodging"]):
            subcategory = "Hotel"
        elif any(x in desc_lower for x in ["grab", "bolt", "uber", "taxi", "cab", "ratp", "mbta", "metro", "transit", "train", "ferry", "bus", "transport"]):
            subcategory = "Cab"
        elif any(x in desc_lower for x in ["flight", "airline", "emirates", "fly", "12go", "vfs", "booking"]):
            subcategory = "Transit"
        elif any(x in desc_lower for x in ["restaurant", "dine", "cafe", "food", "eats", "bistro", "bar", "pub", "pizza", "coffee", "bakery", "laduree", "torry", "ice cream", "abdelwahab", "maison russe", "talay"]):
            subcategory = "Food"
        elif any(x in desc_lower for x in ["shopping", "store", "market", "mall", "duty free", "king power", "zara", "namshi", "h&m", "h and m", "6th street", "namshi", "retail", "tailor", "rami and tommy"]):
            subcategory = "Shopping"
        elif any(x in desc_lower for x in ["museum", "garden", "gardn", "gallery", "attraction", "monument", "observatory", "ste chapelle", "show", "theater", "tickets", "spa", "massage"]):
            subcategory = "Entertainment"
        else:
            subcategory = "Misc"
        return category, subcategory
    
    # --- GROCERIES ---
    if any(x in desc_lower for x in ["carrefour", "spinneys", "grandiose", "lulu", "madhoor", "west zone", "westzone"]):
        category = "Groceries"
        if "carrefour" in desc_lower: subcategory = "Carrefour"
        elif "spinneys" in desc_lower: subcategory = "Spinneys"
        elif "grandiose" in desc_lower: subcategory = "Grandiose"
        elif "lulu" in desc_lower: subcategory = "Lulu"
        elif "madhoor" in desc_lower: subcategory = "Madhoor"
        elif "west zone" in desc_lower or "westzone" in desc_lower: subcategory = "West Zone"
        else: subcategory = "Carrefour"
        
    elif "noon" in desc_lower:
        if "talabat pro" in desc_lower:
            category = "Misc"
            subcategory = "Talabat pro"
        elif "noon one" in desc_lower or "noonone" in desc_lower:
            category = "Misc"
            subcategory = "Noon One"
        else:
            category = "Groceries"
            subcategory = "Noon"
            
    elif "careem" in desc_lower:
        if "dineout" in desc_lower:
            category = "Entertainment"
            subcategory = "Dine-out"
        elif any(x in desc_lower for x in ["quik", "quick", "delivery", "deliveries"]):
            category = "Groceries"
            subcategory = "Careem"
        elif any(x in desc_lower for x in ["ride", "hala"]):
            category = "Transport"
            subcategory = "Taxi"
        else:
            category = "Groceries"
            subcategory = "Careem"
            
    elif "deliveroo" in desc_lower:
        category = "Groceries"
        subcategory = "Deliveroo"
        
    elif "talabat" in desc_lower:
        if "pro" in desc_lower:
            category = "Misc"
            subcategory = "Talabat pro"
        else:
            category = "Entertainment"
            subcategory = "Food Delivery"

    elif "uber" in desc_lower:
        if "eats" in desc_lower:
            category = "Entertainment"
            subcategory = "Food Delivery"
        else:
            category = "Transport"
            subcategory = "Taxi"

    elif "zomato" in desc_lower:
        category = "Entertainment"
        subcategory = "Food Delivery"

    elif "amazon" in desc_lower:
        if any(x in desc_lower for x in ["now", "grocery"]):
            category = "Groceries"
            subcategory = "Amazon Now"
        else:
            category = "Shopping"
            subcategory = "Amazon"

    elif "temu" in desc_lower:
        category = "Shopping"
        subcategory = "Temu"
        
    elif "paypal" in desc_lower:
        category = "Shopping"
        subcategory = "Rep Ladies"
        
    elif any(x in desc_lower for x in ["skincare", "boots", "sephora"]):
        category = "Shopping"
        subcategory = "Skincare"
        
    elif "bikanervala" in desc_lower:
        category = "Misc"
        subcategory = "Obligation"

    elif "furniture" in desc_lower or "furnishing" in desc_lower:
        category = "Shopping"
        subcategory = "Household"

    elif "level shoes" in desc_lower:
        category = "Shopping"
        subcategory = "Shoe"

    elif "sunglass" in desc_lower:
        category = "Shopping"
        subcategory = "Accessories"

    elif "desco" in desc_lower:
        category = "Shopping"
        subcategory = "Household"

    elif any(x in desc_lower for x in ["zara", "namshi", "h&m", "h and m", "6th street", "alshaya", "alsahaya", "futtaim", "calvin", "macy", "ounass", "coach", "rami and tommy", "kaswa"]):
        category = "Shopping"
        subcategory = "Clothes"

    # --- ENTERTAINMENT ---
    elif any(x in desc_lower for x in ["restaurant", "dine-out", "dine out", "cafe", "bistro", "starbucks", "eatery", "coffee", "pub", "bar", "pizza", "burger", "genatsvale", "bait maryam", "dineout", "afghan palace", "al khayma", "maison russe", "abdelwahab", "abdel wahab", "emir bey", "madinat jumeirah", "mons hospitality", "atlantis", "daikan", "farsi", "olives and salt", "san wan", "talay"]):
        category = "Entertainment"
        subcategory = "Dine-out"
        
    elif any(x in desc_lower for x in ["drink", "daaaru", "mmi", "alcohol"]):
        category = "Entertainment"
        subcategory = "Drinks"
        
    elif "expo" in desc_lower:
        category = "Entertainment"
        subcategory = "Expo Tickets"
        
    elif any(x in desc_lower for x in ["snack", "delight", "donner", "candy", "laduree", "torry"]):
        category = "Entertainment"
        subcategory = "Snacks"
        
    elif any(x in desc_lower for x in ["cinema", "ticket", "activity", "activities", "museum", "garden", "gardn", "gallery", "attraction", "monument", "observatory", "ste chapelle"]):
        category = "Entertainment"
        subcategory = "Activities"
        
    # --- UTILITIES ---
    elif "dewa" in desc_lower or "electricity" in desc_lower:
        category = "Utilities"
        subcategory = "DEWA"
        
    elif "al furat" in desc_lower:
        category = "Utilities"
        subcategory = "Water"

    elif any(x in desc_lower for x in ["chiller", "empower", "ista"]):
        category = "Utilities"
        subcategory = "Chiller"
        
    elif any(x in desc_lower for x in ["internet", "du ", "etisalat", "telecom", "e&"]):
        category = "Utilities"
        subcategory = "Internet"
        
    elif any(x in desc_lower for x in ["recharge"]):
        category = "Utilities"
        subcategory = "Mobile Recharge"
        
    elif "cook" in desc_lower:
        category = "Utilities"
        subcategory = "Cook Salary"
        
    # --- GROOMING ---
    elif any(x in desc_lower for x in ["haircut", "barber", "salon", "grooming", "beauty bar", "lish beauty"]):
        category = "Grooming"
        subcategory = "Haircut"
        
    elif any(x in desc_lower for x in ["waxing", "urban company", "urbanclap", "massage", "spa", "charm massage", "moontree spa"]):
        category = "Grooming"
        subcategory = "Waxing"
        
    # --- TRANSPORT ---
    elif any(x in desc_lower for x in ["nol", "rta", "metro", "transit", "smart dubai", "government", "ratp"]):
        category = "Transport"
        subcategory = "Nol Card"
        
    elif any(x in desc_lower for x in ["taxi", "uber", "hala", "grab", "bolt"]):
        category = "Transport"
        subcategory = "Taxi"
        
    elif "bus" in desc_lower:
        category = "Transport"
        subcategory = "Bus"
        
    elif "boat" in desc_lower:
        category = "Transport"
        subcategory = "boat"
        
    # --- TRAVEL ---
    elif any(x in desc_lower for x in ["flight", "airline"]) or ("emirates" in desc_lower and "furniture" not in desc_lower and "furnishing" not in desc_lower):
        category = "Travel"
        subcategory = "Transit"
        
    elif any(x in desc_lower for x in ["ritz carlton", "ritz-carlton", "marriott", "hilton", "hyatt", "sheraton", "westin", "intercontinental", "four seasons", "hotel", "resort", "sala samui", "renaissance paris"]):
        category = "Travel"
        subcategory = "Hotel"
        
    elif any(x in desc_lower for x in ["12go", "payso", "paysolut"]):
        category = "Travel"
        subcategory = "Transit"

    elif any(x in desc_lower for x in ["trip", "travel"]):
        category = "Travel"
        subcategory = "Misc"

    elif any(x in desc_lower for x in ["7-eleven", "7 eleven", "711", "convenience", "minimart", "8 a huit", "8 à huit", "city cart", "fresh mart"]):
        category = "Groceries"
        subcategory = "Convenience"
        
    # --- MEDICAL ---
    elif any(x in desc_lower for x in ["medicine", "pharmacy", "aster"]):
        category = "Medical"
        subcategory = "Medicine"
        
    elif "soda" in desc_lower:
        category = "Medical"
        subcategory = "Soda"
        
    # --- MAINTENANCE ---
    elif "ac cleaning" in desc_lower or "ac_cleaning" in desc_lower:
        category = "Maintenance"
        subcategory = "AC Cleaning"
        
    elif "washroom" in desc_lower:
        category = "Maintenance"
        subcategory = "Washroom"
        
    elif "geyser" in desc_lower:
        category = "Maintenance"
        subcategory = "Geyser"
        
    # --- MISC ---
    elif "license" in desc_lower:
        category = "Misc"
        subcategory = "License"
        
    elif "obligation" in desc_lower:
        category = "Misc"
        subcategory = "Obligation"
        
    # --- REFUNDS & PAYMENTS ---
    if "daily cashback" in desc_lower or "cashback" in desc_lower:
        category = "Groceries"
        subcategory = "Refund"
        
    if "payment" in desc_lower or desc_lower.startswith("to "):
        category = "Rent"
        subcategory = "Refund"
        
    if is_refund:
        subcategory = "Refund"
        
    return category, subcategory

def parse_db_expenses(filePath):
    if not os.path.exists(filePath):
        return []
    expenses = []
    with open(filePath, 'r', encoding='utf-8') as f:
        lines = f.readlines()
    for i in range(1, len(lines)):
        line = lines[i].strip()
        if not line: continue
        
        # Simple CSV parser
        parts = []
        currentPart = ''
        inQuotes = False
        for char in line:
            if char == '"':
                inQuotes = not inQuotes
            elif char == ',' and not inQuotes:
                parts.append(currentPart.strip())
                currentPart = ''
            else:
                currentPart += char
        parts.append(currentPart.strip())
        
        if len(parts) < 6: continue
        
        try:
            amt = float(parts[1])
            cat = parts[2]
            sub = parts[3] if parts[3] and parts[3] != 'null' and parts[3] != 'NULL' else None
            dt = parts[4]
            note = parts[5] if parts[5] and parts[5] != 'null' and parts[5] != 'NULL' else None
            expenses.append({
                "amount": amt,
                "category": cat,
                "subcategory": sub,
                "date": dt,
                "note": note
            })
        except ValueError:
            continue
    return expenses

def is_valid_match(db_exp, tx_desc, tx_cat, tx_sub):
    desc = tx_desc.lower()
    db_sub = (db_exp["subcategory"] or "").lower()
    db_cat = db_exp["category"].lower()
    
    # Specific brand guards to prevent cross-talk
    if "careem" in desc and db_sub != "careem" and db_sub != "taxi": return False
    if "talabat" in desc and db_sub != "talabat" and db_sub != "food delivery" and db_sub != "talabat pro": return False
    if "carrefour" in desc and db_sub != "carrefour": return False
    if "noon" in desc and db_sub != "noon": return False
    if "dewa" in desc and db_sub != "dewa": return False
    if "zara" in desc and db_sub != "clothes": return False
    if "temu" in desc and db_sub != "temu": return False
    if "bikanervala" in desc and db_sub != "obligation" and db_sub != "gift": return False
    if "amazon" in desc and db_sub != "amazon now" and db_sub != "miscellaneous": return False
    if "smart dubai" in desc and db_sub != "nol card": return False
    if "ista" in desc and db_sub != "chiller": return False
    
    # Generic category matching
    if db_cat == "rent" and not any(x in desc for x in ["rent", "payment", "to ", "landlord"]): return False
    
    return True

def find_db_match(tx_date_str, tx_amt, tx_desc, db_expenses):
    # Standardize transaction date
    tx_date = None
    try:
        tx_date = datetime.strptime(tx_date_str, "%Y-%m-%d")
    except ValueError:
        return None

    tx_amt_abs = abs(tx_amt)
    candidates = []

    for db_exp in db_expenses:
        db_amt_abs = abs(db_exp["amount"])
        if abs(db_amt_abs - tx_amt_abs) > 0.05:
            continue
            
        # Date difference check within 2 days
        try:
            db_date = datetime.strptime(db_exp["date"], "%Y-%m-%d")
            day_diff = abs((db_date - tx_date).days)
            if day_diff > 2:
                continue
                
            if is_valid_match(db_exp, tx_desc, db_exp["category"], db_exp["subcategory"]):
                candidates.append((db_exp, day_diff))
        except ValueError:
            continue

    if not candidates:
        return None

    # Sort candidates by date difference (ascending)
    candidates.sort(key=lambda x: x[1])
    return candidates[0][0]

def parse_pdf(pdf_path, db_expenses):
    reader = PdfReader(pdf_path)
    transactions = []
    
    style_a_date_re = re.compile(r'[-]?(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+(\d{1,2}-[A-Za-z]{3}-\d{2,4})')
    style_b_date_re = re.compile(r'(\d{2}/\d{2}/\d{4})')

    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text()
        raw_lines = text.split('\n')
        lines = []
        for rl in raw_lines:
            lines.extend(split_concatenated_lines(rl))
            
        for line in lines:
            line = line.strip()
            if not line:
                continue
                
            # Style A
            match_a = style_a_date_re.search(line)
            if match_a:
                line_to_parse = line[match_a.start():]
                match_a = style_a_date_re.search(line_to_parse)
                
                tx_date_str = match_a.group(1)
                post_date_str = match_a.group(2)
                
                rest = line_to_parse[match_a.end():].strip()
                tokens = rest.split()
                if len(tokens) >= 2:
                    last_token = tokens[-1]
                    if last_token == '-' and len(tokens) >= 2:
                        tokens = tokens[:-1]
                        last_token = tokens[-1]
                        
                    if last_token == 'CR' and len(tokens) >= 2:
                        last_token = tokens[-2] + ' CR'
                        desc_tokens = tokens[:-2]
                    else:
                        desc_tokens = tokens[:-1]
                        
                    amt_val, is_ref = clean_amount(last_token)
                    if amt_val is not None:
                        # Clean multiple amounts from merged lines
                        if len(desc_tokens) > 0:
                            second_last = desc_tokens[-1]
                            if second_last == 'CR' and len(desc_tokens) >= 2:
                                second_last = desc_tokens[-2] + ' CR'
                                temp_val, temp_ref = clean_amount(second_last)
                                if temp_val is not None:
                                    desc_tokens = desc_tokens[:-2]
                            else:
                                temp_val, temp_ref = clean_amount(second_last)
                                if temp_val is not None:
                                    desc_tokens = desc_tokens[:-1]
                                    
                        description = " ".join(desc_tokens).strip()
                        std_date = parse_date_a(tx_date_str)
                        if std_date and description:
                            # Detect foreign currency before description clean-up
                            is_foreign = False
                            desc_upper = description.upper()
                            foreign_currencies = ["EUR", "USD", "THB", "GBP", "SGD", "SAR", "KWD", "BHD", "QAR", "OMR", "INR", "CNY", "JPY", "AUD", "CAD", "CHF", "NZD", "HKD", "SEK", "NOK", "DKK", "MXN", "ZAR", "TRY"]
                            if any(re.search(r'\b' + cur + r'\b', desc_upper) for cur in foreign_currencies) or "FOREIGN CURRENCY" in desc_upper or "PROC. FEE" in desc_upper:
                                is_foreign = True

                            # Strip trailing hyphens or amount fragments from the description
                            description = re.sub(r'\s+\d+,\d+\.\d+(?:\s*CR)?\s*-?$', '', description)
                            description = re.sub(r'\s+\d+\.\d+(?:\s*CR)?\s*-?$', '', description)
                            description = description.replace("NFC - (AP-PAY)-", "").replace("IAP - (AP-PAY)-", "").strip()
                            # Strip foreign currency noise: rate string and fee labels
                            description = re.sub(r'\b(EUR|USD|THB|GBP|SGD|AED|SAR|KWD|BHD|QAR|OMR|INR|CNY|JPY|AUD|CAD|CHF|NZD|HKD|SEK|NOK|DKK|MXN|ZAR|TRY)/AED\s+\.?\d+[\d.]*', '', description)
                            description = re.sub(r'\b(EUR|USD|THB|GBP|SGD|AED|SAR|KWD|BHD|QAR|OMR|INR|CNY|JPY|AUD|CAD|CHF|NZD|HKD|SEK|NOK|DKK|MXN|ZAR|TRY)\b', '', description)
                            description = re.sub(r'FOREIGN CURRENCY PROCESSING FEE.*', '', description, flags=re.IGNORECASE)
                            description = re.sub(r'STND PROC\..*', '', description, flags=re.IGNORECASE)
                            # Strip trailing orphan numeric tokens left after currency removal
                            # e.g. "LE CAFE DUCALE FR 24.50 106.99" → "LE CAFE DUCALE FR"
                            description = re.sub(r'(\s+\d[\d,]*\.\d{2})+\s*$', '', description)
                            description = re.sub(r'\s{2,}', ' ', description).strip()

                            
                            # Ignore cashback, credit card payments, reversals, and empty descriptions
                            desc_upper = description.upper()
                            if not description or "DAILY CASHBACK" in desc_upper or "CASHBACK" in desc_upper or desc_upper.startswith("TO ") or "BILL PAYMENT" in desc_upper or "RVSL" in desc_upper:
                                continue
                            
                            is_refund = is_ref or (amt_val < 0) or ("CASHBACK" in description.upper()) or ("PAYMENT" in description.upper())
                            if is_refund and amt_val > 0:
                                amt_val = -amt_val
                                
                            # Match against database backup to get exact category/subcategory if available
                            db_match = find_db_match(std_date, amt_val, description, db_expenses)
                            if db_match:
                                cat = db_match["category"]
                                sub = db_match["subcategory"] or "Miscellaneous"
                            else:
                                cat, sub = categorize(description, amt_val, is_refund, is_foreign)
                            
                            transactions.append({
                                "date": std_date,
                                "description": description,
                                "amount": amt_val,
                                "category": cat,
                                "subcategory": sub,
                                "isRefund": is_refund,
                                "page": page_idx + 1
                            })
                continue
                
            # Fee-continuation line: foreign transaction fees wrapped to a new line.
            # Pattern: starts with FOREIGN CURRENCY PROCESSING FEE or STND PROC. FEE
            # and ends with a final total AED amount.
            # Only apply if this line has NO date pattern (i.e., it's purely a continuation,
            # not a new transaction that got concatenated after the fees).
            line_upper = line.upper()
            has_date = bool(style_a_date_re.search(line) or style_b_date_re.search(line))
            if not has_date and (line_upper.startswith("FOREIGN CURRENCY") or line_upper.startswith("STND PROC.")) and transactions:
                # Find the last number before an optional trailing ' -'
                fee_line = line.rstrip()
                if fee_line.endswith(' -'):
                    fee_line = fee_line[:-2].strip()
                # Handle CR suffix
                is_cr = fee_line.endswith(' CR')
                if is_cr:
                    fee_line = fee_line[:-3].strip()
                fee_tokens = fee_line.split()
                # Walk back to find last valid float
                for tok in reversed(fee_tokens):
                    tok_clean = tok.replace(',', '')
                    try:
                        final_amt = float(tok_clean)
                        if final_amt > 0:
                            if is_cr:
                                final_amt = -final_amt
                            transactions[-1]["amount"] = final_amt
                        break
                    except ValueError:
                        continue
                continue

            # Style B
            match_b = style_b_date_re.search(line)
            if match_b:
                line_to_parse = line[match_b.start():]
                match_b = style_b_date_re.search(line_to_parse)
                
                tx_date_str = match_b.group(1)
                rest = line_to_parse[match_b.end():].strip()
                tokens = rest.split()
                if len(tokens) >= 2:
                    last_token = tokens[-1]
                    if last_token == '-' and len(tokens) >= 2:
                        tokens = tokens[:-1]
                        last_token = tokens[-1]
                        
                    if last_token == 'CR' and len(tokens) >= 2:
                        last_token = tokens[-2] + ' CR'
                        desc_tokens = tokens[:-2]
                    else:
                        desc_tokens = tokens[:-1]
                        
                    amt_val, is_ref = clean_amount(last_token)
                    if amt_val is not None:
                        description = " ".join(desc_tokens).strip()
                        std_date = parse_date_b(tx_date_str)
                        if std_date and description:
                            # Detect foreign currency before description clean-up
                            is_foreign = False
                            desc_upper = description.upper()
                            foreign_currencies = ["EUR", "USD", "THB", "GBP", "SGD", "SAR", "KWD", "BHD", "QAR", "OMR", "INR", "CNY", "JPY", "AUD", "CAD", "CHF", "NZD", "HKD", "SEK", "NOK", "DKK", "MXN", "ZAR", "TRY"]
                            if any(re.search(r'\b' + cur + r'\b', desc_upper) for cur in foreign_currencies) or "FOREIGN CURRENCY" in desc_upper or "PROC. FEE" in desc_upper:
                                is_foreign = True

                            description = description.replace("NFC - (AP-PAY)-", "").replace("IAP - (AP-PAY)-", "").strip()
                            # Strip foreign currency noise
                            description = re.sub(r'\b(EUR|USD|THB|GBP|SGD|AED|SAR|KWD|BHD|QAR|OMR|INR|CNY|JPY|AUD|CAD|CHF|NZD|HKD|SEK|NOK|DKK|MXN|ZAR|TRY)/AED\s+\.?\d+[\d.]*', '', description)
                            description = re.sub(r'\b(EUR|USD|THB|GBP|SGD|AED|SAR|KWD|BHD|QAR|OMR|INR|CNY|JPY|AUD|CAD|CHF|NZD|HKD|SEK|NOK|DKK|MXN|ZAR|TRY)\b', '', description)
                            description = re.sub(r'FOREIGN CURRENCY PROCESSING FEE.*', '', description, flags=re.IGNORECASE)
                            description = re.sub(r'STND PROC\..*', '', description, flags=re.IGNORECASE)
                            description = re.sub(r'\s{2,}', ' ', description).strip()
                            
                            # Ignore cashback, credit card payments, and reversals (RVSL)
                            desc_upper = description.upper()
                            # Ignore cashback, credit card payments, reversals, and empty descriptions
                            desc_upper = description.upper()
                            if not description or "DAILY CASHBACK" in desc_upper or "CASHBACK" in desc_upper or desc_upper.startswith("TO ") or "BILL PAYMENT" in desc_upper or "RVSL" in desc_upper:
                                continue
                            
                            is_refund = is_ref or (amt_val < 0) or ("CASHBACK" in description.upper()) or ("PAYMENT" in description.upper())
                            if is_refund and amt_val > 0:
                                amt_val = -amt_val
                                
                            # Match against database backup to get exact category/subcategory if available
                            db_match = find_db_match(std_date, amt_val, description, db_expenses)
                            if db_match:
                                cat = db_match["category"]
                                sub = db_match["subcategory"] or "Miscellaneous"
                            else:
                                cat, sub = categorize(description, amt_val, is_refund, is_foreign)
                            
                            transactions.append({
                                "date": std_date,
                                "description": description,
                                "amount": amt_val,
                                "category": cat,
                                "subcategory": sub,
                                "isRefund": is_refund,
                                "page": page_idx + 1
                            })
                continue
                
    return transactions

def main():
    statements_dir = "/Users/arushdixit/Downloads/AI Project/expense-buddy/statements"
    db_csv_path = "/Users/arushdixit/Downloads/AI Project/expense-buddy/backup/expenses_rows.csv"
    
    print("Loading database expenses from CSV backup...")
    db_expenses = parse_db_expenses(db_csv_path)
    print(f"Loaded {len(db_expenses)} database expenses.\n")
    
    if not os.path.exists(statements_dir):
        print(f"Error: Statements directory {statements_dir} does not exist.")
        return
        
    for filename in sorted(os.listdir(statements_dir)):
        if filename.endswith(".pdf") and filename != "Account summary and transactions.pdf":
            pdf_path = os.path.join(statements_dir, filename)
            json_filename = filename.rsplit(".", 1)[0] + ".json"
            output_path = os.path.join(statements_dir, json_filename)
            
            print(f"Parsing PDF statement: {filename}...")
            try:
                txs = parse_pdf(pdf_path, db_expenses)
                print(f"Successfully parsed {len(txs)} transactions.")
                
                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(txs, f, indent=2, ensure_ascii=False)
                print(f"Saved parsed transactions to: {output_path}\n")
            except Exception as e:
                print(f"Failed to parse {filename}: {e}\n")

if __name__ == "__main__":
    main()

import os
import re
import json
from pypdf import PdfReader

# ---------------------------------------------------------------------------
# Module-level compiled patterns — compiled once, reused for every line/page
# ---------------------------------------------------------------------------

# Used by split_concatenated_lines
_SPLIT_A_RE = re.compile(
    r'(-?\d{1,2}-[A-Za-z]{3}-\d{2,4}\s+\d{1,2}-[A-Za-z]{3}-\d{2,4})'
)
_SPLIT_B_RE = re.compile(r'(-?\d{2}/\d{2}/\d{4})')

# Used by parse_pdf for date detection
_STYLE_A_DATE_RE = re.compile(
    r'[-]?(\d{1,2}-[A-Za-z]{3}-\d{2,4})\s+(\d{1,2}-[A-Za-z]{3}-\d{2,4})'
)
_STYLE_B_DATE_RE = re.compile(r'(\d{2}/\d{2}/\d{4})')

# One compiled alternation replaces per-currency re.search() calls in a loop
_FOREIGN_CURRENCY_RE = re.compile(
    r'\b(AUD|BHD|CAD|CHF|CNY|DKK|EUR|GBP|HKD|INR|JPY|KWD|MXN|NOK|NZD|OMR|QAR|SAR|SEK|SGD|THB|TRY|USD|ZAR)\b'
)

# Description noise-stripping patterns
_CUR_RATE_RE = re.compile(
    r'\b(EUR|USD|THB|GBP|SGD|AED|SAR|KWD|BHD|QAR|OMR|INR|CNY|JPY|AUD|CAD|CHF|NZD|HKD|SEK|NOK|DKK|MXN|ZAR|TRY)'
    r'/AED\s+\.?\d[\d.]*'
)
_CUR_CODE_RE = re.compile(
    r'\b(EUR|USD|THB|GBP|SGD|AED|SAR|KWD|BHD|QAR|OMR|INR|CNY|JPY|AUD|CAD|CHF|NZD|HKD|SEK|NOK|DKK|MXN|ZAR|TRY)\b'
)
_PROC_FEE_RE = re.compile(r'FOREIGN CURRENCY PROCESSING FEE.*', re.IGNORECASE)
_STND_PROC_RE = re.compile(r'STND PROC\..*', re.IGNORECASE)
_TRAILING_AMT_COMMA_RE = re.compile(r'\s+\d+,\d+\.\d+(?:\s*CR)?\s*-?$')
_TRAILING_AMT_RE = re.compile(r'\s+\d+\.\d+(?:\s*CR)?\s*-?$')
_ORPHAN_NUM_RE = re.compile(r'(\s+\d[\d,]*\.\d{2})+\s*$')
_MULTI_SPACE_RE = re.compile(r'\s{2,}')

# Transactions whose descriptions match any of these are silently dropped
_SKIP_KEYWORDS = ("DAILY CASHBACK", "CASHBACK", "BILL PAYMENT", "RVSL")


# ---------------------------------------------------------------------------
# Line splitting
# ---------------------------------------------------------------------------

def split_concatenated_lines(line: str) -> list[str]:
    matches = list(_SPLIT_A_RE.finditer(line))
    if not matches:
        matches = list(_SPLIT_B_RE.finditer(line))

    if len(matches) <= 1:
        return [line]

    sub_lines = []
    # Preserve any content that appears before the first date match
    if matches[0].start() > 0:
        leading = line[:matches[0].start()].strip()
        if leading:
            sub_lines.append(leading)
    for i in range(len(matches)):
        start = matches[i].start()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(line)
        sub_lines.append(line[start:end].strip())
    return sub_lines


# ---------------------------------------------------------------------------
# Amount / date helpers
# ---------------------------------------------------------------------------

def clean_amount(amt_str: str) -> tuple[float | None, bool]:
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

def parse_date_a(date_str: str) -> str | None:
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

def parse_date_b(date_str: str) -> str | None:
    parts = date_str.split('/')
    if len(parts) != 3:
        return None
    day = parts[0].zfill(2)
    month = parts[1].zfill(2)
    year = parts[2]
    return f"{year}-{month}-{day}"


# ---------------------------------------------------------------------------
# Categorisation (unchanged)
# ---------------------------------------------------------------------------

def categorize(desc: str, amt: float, is_refund: bool, is_foreign: bool = False) -> tuple[str, str]:
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
        elif any(x in desc_lower for x in ["shopping", "store", "market", "mall", "duty free", "king power", "zara", "namshi", "h&m", "h and m", "6th street", "retail", "tailor", "rami and tommy"]):
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
        elif "food" in desc_lower:
            category = "Entertainment"
            subcategory = "Food Delivery"
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
            category = "Groceries"
            subcategory = "Talabat"

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
        subcategory = "Flight"
        
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


# ---------------------------------------------------------------------------
# Description cleaning helper
# ---------------------------------------------------------------------------

def _clean_description(description: str, extra_cleanup: bool = False) -> str:
    """Strip PDF noise from a raw description string.

    `extra_cleanup=True` enables Style-A-specific trailing amount removal and
    orphan numeric stripping that is not needed for Style B statements.
    """
    if extra_cleanup:
        description = _TRAILING_AMT_COMMA_RE.sub('', description)
        description = _TRAILING_AMT_RE.sub('', description)

    description = (description
                   .replace("NFC - (AP-PAY)-", "")
                   .replace("IAP - (AP-PAY)-", "")
                   .strip())
    description = _CUR_RATE_RE.sub('', description)
    description = _CUR_CODE_RE.sub('', description)
    description = _PROC_FEE_RE.sub('', description)
    description = _STND_PROC_RE.sub('', description)

    if extra_cleanup:
        # Strip trailing orphan numeric tokens left after currency removal
        # e.g. "LE CAFE DUCALE FR 24.50 106.99" → "LE CAFE DUCALE FR"
        description = _ORPHAN_NUM_RE.sub('', description)

    description = _MULTI_SPACE_RE.sub(' ', description).strip()
    return description


# ---------------------------------------------------------------------------
# Shared transaction builder — eliminates the duplicated Style A / B blocks
# ---------------------------------------------------------------------------

def _build_transaction(
    rest: str,
    date_str: str,
    parse_date_fn,
    page_idx: int,
    extra_cleanup: bool = False,
) -> dict | None:
    """Parse the token stream that follows a date match into a transaction dict.

    Returns None if the line should be skipped (bad amount, missing date,
    empty description, or filtered keyword).

    `extra_cleanup=True` enables Style-A-specific merged-amount stripping and
    trailing noise removal inside _clean_description.
    """
    tokens = rest.split()
    if len(tokens) < 2:
        return None

    # Strip trailing lone hyphen artefact
    if tokens[-1] == '-':
        tokens = tokens[:-1]
    if len(tokens) < 2:
        return None

    last_token = tokens[-1]
    if last_token == 'CR' and len(tokens) >= 2:
        last_token = tokens[-2] + ' CR'
        desc_tokens: list[str] = list(tokens[:-2])
    else:
        desc_tokens = list(tokens[:-1])

    amt_val, is_ref = clean_amount(last_token)
    if amt_val is None:
        return None

    # Style A only: strip spurious extra amount tokens merged into description
    if extra_cleanup and desc_tokens:
        second_last = desc_tokens[-1]
        if second_last == 'CR' and len(desc_tokens) >= 2:
            second_last = desc_tokens[-2] + ' CR'
            temp_val, _ = clean_amount(second_last)
            if temp_val is not None:
                desc_tokens = desc_tokens[:-2]
        else:
            temp_val, _ = clean_amount(second_last)
            if temp_val is not None:
                desc_tokens = desc_tokens[:-1]

    description = " ".join(desc_tokens).strip()
    std_date = parse_date_fn(date_str)
    if not std_date or not description:
        return None

    # Detect foreign currency before description clean-up
    desc_upper = description.upper()
    is_foreign = bool(
        _FOREIGN_CURRENCY_RE.search(desc_upper)
        or "FOREIGN CURRENCY" in desc_upper
        or "PROC. FEE" in desc_upper
    )

    description = _clean_description(description, extra_cleanup=extra_cleanup)
    desc_upper = description.upper()

    # Skip cashback, bill payments, reversals, and empty descriptions
    if not description or desc_upper.startswith("TO ") or any(kw in desc_upper for kw in _SKIP_KEYWORDS):
        return None

    is_refund = is_ref or (amt_val < 0) or ("CASHBACK" in desc_upper) or ("PAYMENT" in desc_upper)
    if is_refund and amt_val > 0:
        amt_val = -amt_val

    cat, sub = categorize(description, amt_val, is_refund, is_foreign)

    return {
        "date": std_date,
        "description": description,
        "amount": amt_val,
        "category": cat,
        "subcategory": sub,
        "isRefund": is_refund,
        "page": page_idx + 1,
    }


# ---------------------------------------------------------------------------
# PDF parser
# ---------------------------------------------------------------------------

def parse_pdf(pdf_path: str) -> list[dict]:
    reader = PdfReader(pdf_path)
    transactions: list[dict] = []

    for page_idx, page in enumerate(reader.pages):
        text = page.extract_text()
        # List comprehension is faster than a for-loop with list.extend()
        lines = [
            sub
            for rl in text.split('\n')
            for sub in split_concatenated_lines(rl)
        ]

        for line in lines:
            line = line.strip()
            if not line:
                continue

            # --- Style A ---
            match_a = _STYLE_A_DATE_RE.search(line)
            if match_a:
                line_to_parse = line[match_a.start():]
                tx_date_str = match_a.group(1)
                rest = line_to_parse[match_a.end() - match_a.start():].strip()
                tx = _build_transaction(rest, tx_date_str, parse_date_a, page_idx, extra_cleanup=True)
                if tx:
                    transactions.append(tx)
                continue

            # --- Fee-continuation line ---
            # Foreign transaction fees sometimes wrap onto a new line.
            # Only apply if this line has no date (pure continuation, not a new tx).
            # At this point _STYLE_A_DATE_RE already didn't match, so only check B.
            line_upper = line.upper()
            if (
                not _STYLE_B_DATE_RE.search(line)
                and (line_upper.startswith("FOREIGN CURRENCY") or line_upper.startswith("STND PROC."))
                and transactions
            ):
                fee_line = line.rstrip()
                if fee_line.endswith(' -'):
                    fee_line = fee_line[:-2].strip()
                is_cr = fee_line.endswith(' CR')
                if is_cr:
                    fee_line = fee_line[:-3].strip()
                for tok in reversed(fee_line.split()):
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

            # --- Style B ---
            match_b = _STYLE_B_DATE_RE.search(line)
            if match_b:
                line_to_parse = line[match_b.start():]
                tx_date_str = match_b.group(1)
                rest = line_to_parse[match_b.end() - match_b.start():].strip()
                tx = _build_transaction(rest, tx_date_str, parse_date_b, page_idx, extra_cleanup=False)
                if tx:
                    transactions.append(tx)
                continue

    return transactions


# ---------------------------------------------------------------------------
# Local dev / testing entry point (not used in production)
# ---------------------------------------------------------------------------

def main():
    statements_dir = "/Users/arushdixit/Downloads/AI Project/expense-buddy/statements"

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
                txs = parse_pdf(pdf_path)
                print(f"Successfully parsed {len(txs)} transactions.")

                with open(output_path, 'w', encoding='utf-8') as f:
                    json.dump(txs, f, indent=2, ensure_ascii=False)
                print(f"Saved parsed transactions to: {output_path}\n")
            except Exception as e:
                print(f"Failed to parse {filename}: {e}\n")

if __name__ == "__main__":
    main()

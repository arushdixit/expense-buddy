import { ParsedTransaction } from "./statementParser";

// ---------------------------------------------------------------------------
// Description cleanup regex patterns (mirroring scripts/parse_statements.py)
// ---------------------------------------------------------------------------

const CURRENCIES = "EUR|USD|THB|GBP|SGD|AED|SAR|KWD|BHD|QAR|OMR|INR|CNY|JPY|AUD|CAD|CHF|NZD|HKD|SEK|NOK|DKK|MXN|ZAR|TRY";

const CONVERSION_RATE_RE = /\[1\s+[A-Z]{3}\s*=\s*AED\s*[\d.]+\]/gi;
const FOREIGN_VAL_CLEAN_RE = new RegExp(
  `\\b\\d+[\\d,]*\\.\\d{2}\\s*\\b(${CURRENCIES})\\b|\\b(${CURRENCIES})\\b\\s*-?\\d+[\\d,]*\\.\\d{2}`,
  "gi"
);
const CUR_RATE_RE = new RegExp(`\\b(${CURRENCIES})/AED\\s+\\.?\\d[\\d.]*`, "gi");
const CUR_CODE_RE = new RegExp(`\\b(${CURRENCIES})\\b`, "gi");
const PROC_FEE_RE = /FOREIGN CURRENCY PROCESSING FEE.*/gi;
const STND_PROC_RE = /STND PROC\..*/gi;
const MART_RE = /\b(?:\w*?)(?<!s)marts?\b/i;

export function cleanDescription(description: string): string {
  let desc = description;
  desc = desc.replace(CONVERSION_RATE_RE, "");
  desc = desc.replace(FOREIGN_VAL_CLEAN_RE, "");

  desc = desc
    .replace("NFC - (AP-PAY)-", "")
    .replace("IAP - (AP-PAY)-", "")
    .replace("|", "")
    .trim();

  desc = desc.replace(CUR_RATE_RE, "");
  desc = desc.replace(CUR_CODE_RE, "");
  desc = desc.replace(PROC_FEE_RE, "");
  desc = desc.replace(STND_PROC_RE, "");

  desc = desc.replace(/\s{2,}/g, " ").trim();
  return desc;
}

// ---------------------------------------------------------------------------
// Categorization logic (exact port of scripts/parse_statements.py categorize())
// ---------------------------------------------------------------------------

export function categorizeTransaction(
  desc: string,
  amt: number,
  isRefund: boolean,
  isForeign: boolean = false
): { category: string; subcategory: string } {
  const descLower = desc.toLowerCase().trim();

  // General overrides
  if (descLower.includes("mbta")) return { category: "Travel", subcategory: "Transit" };
  if (descLower.includes("vfs")) return { category: "Travel", subcategory: "Visa" };
  if (descLower.includes("driving") || descLower.includes("license")) return { category: "Misc", subcategory: "License" };

  // Defaults
  let category = "Shopping";
  let subcategory = "Miscellaneous";

  // Foreign / Travel Force
  if (isForeign) {
    category = "Travel";
    const hotelKeywords = ["hotel", "resort", "villa", "stay", "suites", "ritz", "marriott", "hilton", "hyatt", "renaissance", "sala samui", "airbnb", "hostel", "lodging"];
    const cabKeywords = ["grab", "bolt", "uber", "taxi", "cab", "ratp", "mbta", "metro", "transit", "train", "ferry", "bus", "transport"];
    const transitKeywords = ["flight", "airline", "emirates", "fly", "12go", "vfs", "booking"];
    const foodKeywords = ["restaurant", "dine", "cafe", "food", "eats", "bistro", "bar", "pub", "pizza", "coffee", "bakery", "laduree", "torry", "ice cream", "abdelwahab", "maison russe", "talay"];
    const shoppingKeywords = ["shopping", "store", "market", "mall", "duty free", "king power", "zara", "namshi", "h&m", "h and m", "6th street", "retail", "tailor", "rami and tommy"];
    const entertainmentKeywords = ["museum", "garden", "gardn", "gallery", "attraction", "monument", "observatory", "ste chapelle", "show", "theater", "tickets", "spa", "massage"];

    if (hotelKeywords.some(k => descLower.includes(k))) subcategory = "Hotel";
    else if (cabKeywords.some(k => descLower.includes(k))) subcategory = "Cab";
    else if (transitKeywords.some(k => descLower.includes(k))) subcategory = "Transit";
    else if (foodKeywords.some(k => descLower.includes(k))) subcategory = "Food";
    else if (shoppingKeywords.some(k => descLower.includes(k))) subcategory = "Shopping";
    else if (entertainmentKeywords.some(k => descLower.includes(k))) subcategory = "Entertainment";
    else subcategory = "Misc";

    return { category, subcategory };
  }

  // --- GROCERIES ---
  const groceryStores = ["carrefour", "spinneys", "grandiose", "lulu", "madhoor", "west zone", "westzone"];
  if (groceryStores.some(k => descLower.includes(k))) {
    category = "Groceries";
    if (descLower.includes("carrefour")) subcategory = "Carrefour";
    else if (descLower.includes("spinneys")) subcategory = "Spinneys";
    else if (descLower.includes("grandiose")) subcategory = "Grandiose";
    else if (descLower.includes("lulu")) subcategory = "Lulu";
    else if (descLower.includes("madhoor")) subcategory = "Madhoor";
    else if (descLower.includes("west zone") || descLower.includes("westzone")) subcategory = "West Zone";
    else subcategory = "Carrefour";
  } else if (descLower.includes("noon")) {
    if (descLower.includes("talabat pro")) {
      category = "Misc";
      subcategory = "Talabat pro";
    } else if (descLower.includes("noon one") || descLower.includes("noonone")) {
      category = "Misc";
      subcategory = "Noon One";
    } else if (["minutes", "now", "grocery", "groceries", "supermarket", "daily"].some(k => descLower.includes(k))) {
      category = "Groceries";
      subcategory = "Noon";
    } else if (["food", "dubai", "eats", "restaurant"].some(k => descLower.includes(k))) {
      category = "Entertainment";
      subcategory = "Food Delivery";
    } else {
      category = "Shopping";
      subcategory = "Noon";
    }
  } else if (descLower.includes("careem")) {
    if (descLower.includes("dineout")) {
      category = "Entertainment";
      subcategory = "Dine-out";
    } else if (["quik", "quick", "delivery", "deliveries"].some(k => descLower.includes(k))) {
      category = "Groceries";
      subcategory = "Careem";
    } else if (["ride", "hala"].some(k => descLower.includes(k))) {
      category = "Transport";
      subcategory = "Taxi";
    } else {
      category = "Groceries";
      subcategory = "Careem";
    }
  } else if (descLower.includes("deliveroo")) {
    category = "Groceries";
    subcategory = "Deliveroo";
  } else if (descLower.includes("talabat")) {
    if (descLower.includes("pro")) {
      category = "Misc";
      subcategory = "Talabat pro";
    } else {
      category = "Groceries";
      subcategory = "Talabat";
    }
  } else if (descLower.includes("uber")) {
    if (descLower.includes("eats")) {
      category = "Entertainment";
      subcategory = "Food Delivery";
    } else {
      category = "Transport";
      subcategory = "Taxi";
    }
  } else if (descLower.includes("zomato")) {
    category = "Entertainment";
    subcategory = "Food Delivery";
  } else if (descLower.includes("amazon")) {
    if (["now", "grocery"].some(k => descLower.includes(k))) {
      category = "Groceries";
      subcategory = "Amazon Now";
    } else {
      category = "Shopping";
      subcategory = "Amazon";
    }
  } else if (descLower.includes("temu")) {
    category = "Shopping";
    subcategory = "Temu";
  } else if (descLower.includes("paypal")) {
    category = "Shopping";
    subcategory = "Rep Ladies";
  } else if (["skincare", "boots", "sephora"].some(k => descLower.includes(k))) {
    category = "Shopping";
    subcategory = "Skincare";
  } else if (descLower.includes("bikanervala")) {
    category = "Misc";
    subcategory = "Obligation";
  } else if (descLower.includes("furniture") || descLower.includes("furnishing")) {
    category = "Shopping";
    subcategory = "Household";
  } else if (descLower.includes("level shoes")) {
    category = "Shopping";
    subcategory = "Shoe";
  } else if (descLower.includes("sunglass")) {
    category = "Shopping";
    subcategory = "Accessories";
  } else if (descLower.includes("desco")) {
    category = "Shopping";
    subcategory = "Household";
  } else if (["zara", "namshi", "h&m", "h and m", "6th street", "alshaya", "alsahaya", "futtaim", "calvin", "macy", "ounass", "coach", "rami and tommy", "kaswa"].some(k => descLower.includes(k))) {
    category = "Shopping";
    subcategory = "Clothes";
  }
  // --- ENTERTAINMENT ---
  else if (["restaurant", "dine-out", "dine out", "cafe", "bistro", "starbucks", "eatery", "coffee", "pub", "bar", "pizza", "burger", "genatsvale", "bait maryam", "dineout", "afghan palace", "al khayma", "maison russe", "abdelwahab", "abdel wahab", "emir bey", "madinat jumeirah", "mons hospitality", "atlantis", "daikan", "farsi", "olives and salt", "san wan", "talay", "millennium place", "millennium"].some(k => descLower.includes(k))) {
    category = "Entertainment";
    subcategory = "Dine-out";
  } else if (["drink", "daaaru", "mmi", "alcohol"].some(k => descLower.includes(k))) {
    category = "Entertainment";
    subcategory = "Drinks";
  } else if (descLower.includes("expo")) {
    category = "Entertainment";
    subcategory = "Expo Tickets";
  } else if (["snack", "delight", "donner", "candy", "laduree", "torry"].some(k => descLower.includes(k))) {
    category = "Entertainment";
    subcategory = "Snacks";
  } else if (["cinema", "ticket", "activity", "activities", "museum", "garden", "gardn", "gallery", "attraction", "monument", "observatory", "ste chapelle"].some(k => descLower.includes(k))) {
    category = "Entertainment";
    subcategory = "Activities";
  }
  // --- UTILITIES ---
  else if (descLower.includes("dewa") || descLower.includes("electricity")) {
    category = "Utilities";
    subcategory = "DEWA";
  } else if (descLower.includes("al furat")) {
    category = "Utilities";
    subcategory = "Water";
  } else if (["chiller", "empower", "ista"].some(k => descLower.includes(k))) {
    category = "Utilities";
    subcategory = "Chiller";
  } else if (["internet", "du ", "etisalat", "telecom", "e&"].some(k => descLower.includes(k))) {
    category = "Utilities";
    if (descLower.includes("e&") && Math.abs(amt - 50.0) < 0.01) {
      subcategory = "Mobile Recharge";
    } else {
      subcategory = "Internet";
    }
  } else if (descLower.includes("recharge")) {
    category = "Utilities";
    subcategory = "Mobile Recharge";
  } else if (descLower.includes("cook")) {
    category = "Utilities";
    subcategory = "Cook Salary";
  }
  // --- GROOMING ---
  else if (["haircut", "barber", "salon", "grooming", "beauty bar", "lish beauty", "clippers"].some(k => descLower.includes(k))) {
    category = "Grooming";
    subcategory = "Haircut";
  } else if (["waxing", "urban company", "urbanclap", "massage", "spa", "charm massage", "moontree spa"].some(k => descLower.includes(k))) {
    category = "Grooming";
    subcategory = "Waxing";
  }
  // --- TRANSPORT ---
  else if (["nol", "rta", "metro", "transit", "smart dubai", "government", "ratp"].some(k => descLower.includes(k))) {
    category = "Transport";
    subcategory = "Nol Card";
  } else if (["taxi", "uber", "hala", "grab", "bolt"].some(k => descLower.includes(k))) {
    category = "Transport";
    subcategory = "Taxi";
  } else if (descLower.includes("bus")) {
    category = "Transport";
    subcategory = "Bus";
  } else if (descLower.includes("boat")) {
    category = "Transport";
    subcategory = "boat";
  }
  // --- TRAVEL ---
  else if (["flight", "airline"].some(k => descLower.includes(k)) || (descLower.includes("emirates") && !descLower.includes("furniture") && !descLower.includes("furnishing"))) {
    category = "Travel";
    subcategory = "Flight";
  } else if (["ritz carlton", "ritz-carlton", "marriott", "hilton", "hyatt", "sheraton", "westin", "intercontinental", "four seasons", "hotel", "resort", "sala samui", "renaissance paris"].some(k => descLower.includes(k))) {
    category = "Travel";
    subcategory = "Hotel";
  } else if (["12go", "payso", "paysolut"].some(k => descLower.includes(k))) {
    category = "Travel";
    subcategory = "Transit";
  } else if (["trip", "travel"].some(k => descLower.includes(k))) {
    category = "Travel";
    subcategory = "Misc";
  } else if (MART_RE.test(descLower) || ["7-eleven", "7 eleven", "711", "convenience", "minimart", "8 a huit", "8 à huit", "city cart", "fresh mart"].some(k => descLower.includes(k))) {
    category = "Groceries";
    subcategory = "Convenience";
  }
  // --- MEDICAL ---
  else if (["medicine", "pharmacy", "aster"].some(k => descLower.includes(k))) {
    category = "Medical";
    subcategory = "Medicine";
  } else if (descLower.includes("soda")) {
    category = "Medical";
    subcategory = "Soda";
  }
  // --- MAINTENANCE ---
  else if (descLower.includes("ac cleaning") || descLower.includes("ac_cleaning")) {
    category = "Maintenance";
    subcategory = "AC Cleaning";
  } else if (descLower.includes("washroom")) {
    category = "Maintenance";
    subcategory = "Washroom";
  } else if (descLower.includes("geyser")) {
    category = "Maintenance";
    subcategory = "Geyser";
  }
  // --- MISC ---
  else if (descLower.includes("license")) {
    category = "Misc";
    subcategory = "License";
  } else if (descLower.includes("obligation")) {
    category = "Misc";
    subcategory = "Obligation";
  }

  // --- REFUNDS & PAYMENTS ---
  if (descLower.includes("daily cashback") || descLower.includes("cashback")) {
    category = "Groceries";
    subcategory = "Refund";
  }
  if (descLower.includes("payment") || descLower.startsWith("to ")) {
    category = "Rent";
    subcategory = "Refund";
  }
  if (isRefund) {
    subcategory = "Refund";
  }

  return { category, subcategory };
}

// ---------------------------------------------------------------------------
// CSV Parser for Wio Statement CSV files
// ---------------------------------------------------------------------------

function parseCsvRows(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"') {
      if (inQuotes && nextChar === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === "\r" || char === "\n") && !inQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i++;
      }
      row.push(current);
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) {
        lines.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  if (current || row.length > 0) {
    row.push(current);
    if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) {
      lines.push(row);
    }
  }

  return lines;
}

export function parseWioCsvText(csvText: string): ParsedTransaction[] {
  const rows = parseCsvRows(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.trim());
  const headerMap: Record<string, number> = {};
  headers.forEach((h, idx) => {
    headerMap[h] = idx;
  });

  const required = ["Date", "Description", "Amount", "Account currency"];
  const hasRequired = required.every(field => field in headerMap);
  if (!hasRequired) {
    throw new Error("CSV header does not match Wio statement format.");
  }

  const dateIdx = headerMap["Date"];
  const descIdx = headerMap["Description"];
  const amtIdx = headerMap["Amount"];
  const curIdx = headerMap["Account currency"];
  const notesIdx = headerMap["Notes"] !== undefined ? headerMap["Notes"] : -1;

  const transactions: ParsedTransaction[] = [];

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const dateStr = (row[dateIdx] || "").trim();
    const description = (row[descIdx] || "").trim();
    const amountStr = (row[amtIdx] || "").trim();
    const accCurrency = (row[curIdx] || "").trim().toUpperCase();
    const notes = notesIdx >= 0 ? (row[notesIdx] || "").trim() : "";

    const rawAmount = parseFloat(amountStr);
    if (isNaN(rawAmount)) continue;

    // Wio: negative for purchases, positive for transfers/refunds.
    // Invert: purchases are positive, refunds are negative.
    let isRefund = false;
    let amtVal = 0;
    if (rawAmount < 0) {
      amtVal = -rawAmount;
    } else {
      amtVal = -rawAmount;
      isRefund = true;
    }

    const cleanedDesc = cleanDescription(description);
    const descUpper = cleanedDesc.toUpperCase();
    const notesUpper = notes.toUpperCase();

    if (!cleanedDesc) continue;

    // Filter incoming salaries, dividends, transfers to wife (Pamoli)
    if (
      descUpper.includes("SALARY") ||
      descUpper.includes("DIVIDEND") ||
      descUpper.includes("PAMOLI") ||
      notesUpper.includes("DIVIDEND")
    ) {
      continue;
    }

    const isForeign = accCurrency !== "AED";
    let originalAmount: number | undefined = undefined;
    let originalCurrency: string | undefined = undefined;
    if (isForeign) {
      originalAmount = Math.abs(rawAmount);
      originalCurrency = accCurrency;
      if (accCurrency === "USD") {
        amtVal = Math.round(amtVal * 3.6725 * 100) / 100;
      }
    }

    const { category, subcategory } = categorizeTransaction(cleanedDesc, amtVal, isRefund, isForeign);

    const tx: ParsedTransaction = {
      date: dateStr,
      description: cleanedDesc,
      amount: amtVal,
      category,
      subcategory,
      isRefund,
      page: 1,
      card: "Wio",
    };

    if (isForeign) {
      tx.isForeign = true;
      tx.originalAmount = originalAmount;
      tx.originalCurrency = originalCurrency;
    }

    transactions.push(tx);
  }

  return transactions;
}

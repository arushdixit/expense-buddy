import { db, LocalExpense } from './db';
import { getStatementRecords } from './statementParser';

/**
 * Determine the correct payment card for an expense based on historical rules.
 */
export const classifyExpenseCard = (exp: {
  date: string;
  category: string;
  subcategory?: string | null;
  note?: string | null;
  amount?: number;
}): string => {
  const noteUpper = (exp.note || '').toUpperCase();
  const subcatUpper = (exp.subcategory || '').toUpperCase();
  const catUpper = (exp.category || '').toUpperCase();

  // Rule 1: Explicit tags in note take precedence (e.g. "CARD: SIB", "CARD: HSBC")
  if (noteUpper.includes("CARD: ADCB")) return "ADCB";
  if (noteUpper.includes("CARD: SIB")) return "SIB";
  if (noteUpper.includes("CARD: SHARE")) return "Share";
  if (noteUpper.includes("CARD: NOON")) return "Noon";
  if (noteUpper.includes("CARD: HSBC")) return "HSBC";
  if (noteUpper.includes("CARD: WIO")) return "Wio";
  if (noteUpper.includes("CARD: BANK TRANSFER")) return "Bank Transfer";

  // Rule 2: Rent and Cook salary are always Bank Transfer
  if (catUpper === 'RENT' || subcatUpper.includes('COOK') || noteUpper.includes('COOK') || subcatUpper.includes('SALARY') || noteUpper.includes('COOK SALARY')) {
    return 'Bank Transfer';
  }

  // Rule 3: Transactions from beginning of history up to 20th Feb 2026 are HSBC
  if (exp.date < '2026-02-20') {
    return 'HSBC';
  }

  // Rule 4: Special handling for June 2026
  // Only official transactions present in "Wio Monthly statement (2026.06).csv" are Wio.
  // All other June expenses belong to HSBC.
  if (exp.date >= '2026-06-01' && exp.date <= '2026-06-30') {
    const juneWioSet = [
      { date: '2026-06-01', amount: 12.76 },
      { date: '2026-06-02', amount: 83.52 },
      { date: '2026-06-04', amount: 3.75 },
      { date: '2026-06-04', amount: -13.11 },
      { date: '2026-06-07', amount: 22.50 },
      { date: '2026-06-08', amount: 240.21 },
      { date: '2026-06-08', amount: 23.00 },
      { date: '2026-06-08', amount: 15.35 },
      { date: '2026-06-09', amount: 20.00 },
      { date: '2026-06-09', amount: -44.14 },
      { date: '2026-06-10', amount: 0.09 },
      { date: '2026-06-12', amount: 5.97 },
      { date: '2026-06-15', amount: 12.76 },
      { date: '2026-06-16', amount: 22.00 },
      { date: '2026-06-16', amount: 84.00 },
      { date: '2026-06-16', amount: 50.00 },
      { date: '2026-06-18', amount: 15.00 },
      { date: '2026-06-19', amount: 15.00 },
      { date: '2026-06-19', amount: 11.47 },
      { date: '2026-06-22', amount: 37.14 },
      { date: '2026-06-22', amount: 25.80 },
      { date: '2026-06-22', amount: 36.50 },
      { date: '2026-06-23', amount: 12.50 },
      { date: '2026-06-23', amount: 16.99 },
      { date: '2026-06-24', amount: 5.25 },
      { date: '2026-06-25', amount: 6.69 },
      { date: '2026-06-25', amount: 100.00 },
      { date: '2026-06-26', amount: 50.00 },
      { date: '2026-06-30', amount: 32.00 },
    ];

    const expAmt = exp.amount !== undefined ? Math.round(exp.amount * 100) / 100 : null;
    const isWioJuneMatch = juneWioSet.some(w => w.date === exp.date && (expAmt === null || Math.abs(Math.abs(w.amount) - expAmt) < 0.01));

    if (isWioJuneMatch) {
      return 'Wio';
    }
    return 'HSBC';
  }

  // Rule 5: Transactions from July 2026 onwards by merchant / pattern
  if (
    noteUpper.includes('URBANCLAP') ||
    noteUpper.includes('CARREFOUR MARKET JLT ARMA') ||
    noteUpper.includes('TRANSFER PAYMENT RECEIVED') ||
    noteUpper.includes('SHARE')
  ) {
    return 'Share';
  }

  if (
    noteUpper.includes('ZARA.COM') ||
    noteUpper.includes('CAREEM FOOD') ||
    noteUpper.includes('TKD FASHION') ||
    noteUpper.includes('AMAZON.AE') ||
    noteUpper.includes('DOORDASH') ||
    noteUpper.includes('UBER EATS') ||
    noteUpper.includes('THE LIBERTY HOTEL') ||
    noteUpper.includes('SIB')
  ) {
    return 'SIB';
  }

  if (noteUpper.includes('NOON') || subcatUpper.includes('NOON')) {
    return 'Noon';
  }

  if (
    noteUpper.includes('TAKEDA') ||
    noteUpper.includes('MBTA') ||
    noteUpper.includes('7-ELEVEN') ||
    noteUpper.includes('ROCKIN BURGERS') ||
    noteUpper.includes('CARREFOUR MARKET JLT A DUBAI ARE') ||
    noteUpper.includes('ANNUAL FEE') ||
    noteUpper.includes('ADCB')
  ) {
    return 'ADCB';
  }

  if (
    noteUpper.includes('DUBAI ELECTRICITY') ||
    noteUpper.includes('DEWA') ||
    noteUpper.includes('HSBC')
  ) {
    return 'HSBC';
  }

  if (
    noteUpper.includes('WIO') ||
    subcatUpper.includes('WIO') ||
    noteUpper.includes('TEMU') ||
    noteUpper.includes('WEST ZONE') ||
    noteUpper.includes('NATIONAL TAXI') ||
    noteUpper.includes('BABEL') ||
    noteUpper.includes('KAMAT') ||
    noteUpper.includes('HAPPY FRESH') ||
    noteUpper.includes('CLIPPERS') ||
    noteUpper.includes('MILLENNIUM') ||
    noteUpper.includes('PAUL') ||
    noteUpper.includes('RAJU OMLET') ||
    noteUpper.includes('DUBAYPAY RTA') ||
    noteUpper.includes('DUBAIPAY RTA') ||
    noteUpper.includes('STA') ||
    noteUpper.includes('MOHESR') ||
    noteUpper.includes('CARS TAXI') ||
    noteUpper.includes('ARABIA TAXI') ||
    noteUpper.includes('INVOLUNTARY LOSS')
  ) {
    return 'Wio';
  }

  return 'HSBC';
};

/**
 * Execute automated historical migration to populate `card` column for all local Dexie expenses.
 */
export const runCardMigration = async (): Promise<{ updatedCount: number }> => {
  let updatedCount = 0;

  try {
    const expenses = await db.expenses.toArray();
    const updates: LocalExpense[] = [];

    for (const exp of expenses) {
      const targetCard = classifyExpenseCard(exp);
      if (!exp.card || exp.card !== targetCard) {
        updates.push({
          ...exp,
          card: targetCard,
          syncStatus: exp.syncStatus === 'synced' ? 'pending' : exp.syncStatus,
          updatedAt: Date.now(),
        });
        updatedCount++;
      }
    }

    if (updates.length > 0) {
      await db.expenses.bulkPut(updates);
      console.log(`[Card Migration] Updated ${updates.length} expense records with card classification.`);
    }

    // Also update backup expenses if present
    const backupExpenses = await db.expenses_backup.toArray();
    const backupUpdates: LocalExpense[] = [];

    for (const exp of backupExpenses) {
      const targetCard = classifyExpenseCard(exp);
      if (!exp.card || exp.card !== targetCard) {
        backupUpdates.push({
          ...exp,
          card: targetCard,
          syncStatus: exp.syncStatus === 'synced' ? 'pending' : exp.syncStatus,
          updatedAt: Date.now(),
        });
      }
    }

    if (backupUpdates.length > 0) {
      await db.expenses_backup.bulkPut(backupUpdates);
      console.log(`[Card Migration] Updated ${backupUpdates.length} backup expense records with card classification.`);
    }

  } catch (err) {
    console.error('[Card Migration Error]:', err);
  }

  return { updatedCount };
};

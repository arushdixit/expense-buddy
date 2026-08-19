import { statementCoverageApi } from "@/lib/api";

// ParsedTransaction is the shape returned by the /api/parse_statement serverless function
// and used throughout the ImportView UI.
export interface ParsedTransaction {
    id?: string;
    date: string;
    description: string;
    amount: number;
    category: string;
    subcategory: string;
    isRefund: boolean;
    page: number;
    isForeign?: boolean;
    originalAmount?: number;
    originalCurrency?: string;
    card?: string;
    statement_date?: string;       // Actual statement/billing date from PDF header (period end)
    statement_start_date?: string; // Actual period start date from PDF header
}

export interface StatementRecord {
    card: string;
    startDate: string;
    endDate: string;
    filename: string;
    importedAt: number;
    totalAmount?: number;
    transactionCount?: number;
    monthlySpending?: Record<string, number>;
    monthlyCounts?: Record<string, number>;
}

// Get statement coverage records from localStorage
export const getStatementRecords = (): StatementRecord[] => {
    try {
        const stored = localStorage.getItem("statement_coverage");
        return stored ? JSON.parse(stored) : [];
    } catch (e) {
        console.error("Failed to parse statement coverage records:", e);
        return [];
    }
};

// Add a statement record to localStorage + push to Supabase
export const addStatementRecord = (
    card: string,
    startDate: string,     // actual period start from PDF (statement_start_date), or min tx date as fallback
    endDate: string,       // actual period end / statement date from PDF
    filename: string,
    transactions?: { date: string; amount: number }[]
): void => {
    try {
        const records = getStatementRecords();

        let totalAmount = 0;
        let transactionCount = 0;
        const monthlySpending: Record<string, number> = {};
        const monthlyCounts: Record<string, number> = {};

        if (Array.isArray(transactions) && transactions.length > 0) {
            transactionCount = transactions.length;
            transactions.forEach(tx => {
                const amt = Math.abs(tx.amount || 0);
                totalAmount += amt;
                if (tx.date && tx.date.length >= 7) {
                    const mKey = tx.date.substring(0, 7);
                    monthlySpending[mKey] = Math.round(((monthlySpending[mKey] || 0) + amt) * 100) / 100;
                    monthlyCounts[mKey] = (monthlyCounts[mKey] || 0) + 1;
                }
            });
        }

        const newRecord: StatementRecord = {
            card,
            startDate,
            endDate,
            filename: filename || "Uploaded Statement",
            importedAt: Date.now(),
            totalAmount: Math.round(totalAmount * 100) / 100,
            transactionCount,
            monthlySpending: Object.keys(monthlySpending).length > 0 ? monthlySpending : undefined,
            monthlyCounts: Object.keys(monthlyCounts).length > 0 ? monthlyCounts : undefined,
        };

        // Check for duplicate cycle or filename
        const existingIdx = records.findIndex(
            (r) => r.card === card && (r.filename === filename || (r.startDate === startDate && r.endDate === endDate))
        );

        if (existingIdx >= 0) {
            records[existingIdx] = {
                ...records[existingIdx],
                ...newRecord,
                monthlySpending: newRecord.monthlySpending || records[existingIdx].monthlySpending,
                monthlyCounts: newRecord.monthlyCounts || records[existingIdx].monthlyCounts,
            };
        } else {
            records.push(newRecord);
        }

        localStorage.setItem("statement_coverage", JSON.stringify(records));

        // Asynchronously push to Supabase so all devices can sync it
        statementCoverageApi.upsert({
            card,
            statement_start: startDate,
            statement_end: endDate,
            filename: filename || "Uploaded Statement",
            imported_at: newRecord.importedAt,
        }).catch((err) => {
            console.error("Failed to push statement coverage to Supabase:", err);
        });
    } catch (e) {
        console.error("Failed to save statement coverage record:", e);
    }
};

// Sync statement coverage records from Supabase (Single Source of Truth)
export const syncStatementRecordsFromServer = async (): Promise<void> => {
    try {
        const localRecords = getStatementRecords();
        const recordMap = new Map<string, StatementRecord>();

        // Populate from local storage cache first
        if (Array.isArray(localRecords)) {
            localRecords.forEach(r => {
                if (!r || !r.card || !r.startDate || !r.endDate) return;
                const key = `${r.card}_${r.filename || r.endDate}`;
                const current = recordMap.get(key);
                if (!current || (r.importedAt || 0) >= (current.importedAt || 0)) {
                    recordMap.set(key, r);
                }
            });
        }

        // --- Step 1: Pull all server records from Supabase and merge ---
        const serverRecords = await statementCoverageApi.getAll();
        const serverKeys = new Set<string>();

        if (Array.isArray(serverRecords) && serverRecords.length > 0) {
            for (const sr of serverRecords) {
                const key = `${sr.card}_${sr.filename}`;
                serverKeys.add(key);
                const current = recordMap.get(key);
                const asLocal: StatementRecord = {
                    card: sr.card,
                    startDate: sr.statement_start,
                    endDate: sr.statement_end,
                    filename: sr.filename,
                    importedAt: sr.imported_at,
                };
                if (!current || sr.imported_at >= (current.importedAt || 0)) {
                    recordMap.set(key, asLocal);
                }
            }
        }

        // Save merged records to localStorage cache
        const merged = Array.from(recordMap.values());
        localStorage.setItem("statement_coverage", JSON.stringify(merged));

        // --- Step 2: Push any local-only records up to Supabase ---
        for (const r of merged) {
            if (!r?.card || !r?.startDate || !r?.endDate) continue;
            const key = `${r.card}_${r.filename || r.endDate}`;
            if (!serverKeys.has(key)) {
                statementCoverageApi.upsert({
                    card: r.card,
                    statement_start: r.startDate,
                    statement_end: r.endDate,
                    filename: r.filename || "Uploaded Statement",
                    imported_at: r.importedAt || Date.now(),
                }).catch(() => {});
            }
        }
    } catch (e) {
        console.error("Failed to sync statement coverage:", e);
    }
};

// Backwards-compatible alias
export const seedStatementRecords = syncStatementRecordsFromServer;


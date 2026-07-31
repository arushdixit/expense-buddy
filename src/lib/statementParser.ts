import { db } from "@/lib/db";

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

// Add a statement record to localStorage & IndexedDB with automatic spending calculations
export const addStatementRecord = (
    card: string,
    startDate: string,
    endDate: string,
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

        // Asynchronously persist to Dexie IndexedDB
        if (typeof db !== "undefined" && db.statementCoverage) {
            db.statementCoverage.put(newRecord).catch((err) => {
                console.error("Dexie Error putting statementCoverage:", err);
            });
        }
    } catch (e) {
        console.error("Failed to save statement coverage record:", e);
    }
};

// Seed historical statements and replace stale records cleanly
export const seedStatementRecords = async (): Promise<void> => {
    try {
        const res = await fetch("/seeded_coverage.json");
        if (!res.ok) throw new Error("Failed to load seeded coverage data");
        const seeded: StatementRecord[] = await res.json();

        const existing = getStatementRecords();
        const recordMap = new Map<string, StatementRecord>();

        // First populate from seeded JSON
        if (Array.isArray(seeded)) {
            seeded.forEach(r => {
                if (r && r.card && r.startDate && r.endDate) {
                    const key = `${r.card}_${r.filename || r.endDate}`;
                    recordMap.set(key, r);
                }
            });
        }

        // Also populate from IndexedDB if available
        try {
            if (typeof db !== "undefined" && db.statementCoverage) {
                const dbRecords = await db.statementCoverage.toArray();
                if (Array.isArray(dbRecords)) {
                    dbRecords.forEach(r => {
                        if (r && r.card && r.startDate && r.endDate) {
                            const key = `${r.card}_${r.filename || r.endDate}`;
                            const current = recordMap.get(key);
                            if (!current || (r.importedAt || 0) >= (current.importedAt || 0)) {
                                recordMap.set(key, r);
                            }
                        }
                    });
                }
            }
        } catch (dbErr) {
            console.error("Failed to load statement records from Dexie IndexedDB:", dbErr);
        }

        // Merge existing user-uploaded records so they are preserved
        if (Array.isArray(existing)) {
            existing.forEach(r => {
                if (r && r.card && r.startDate && r.endDate) {
                    const key = `${r.card}_${r.filename || r.endDate}`;
                    const current = recordMap.get(key);
                    if (!current || (r.importedAt || 0) >= (current.importedAt || 0)) {
                        recordMap.set(key, r);
                    }
                }
            });
        }

        const merged = Array.from(recordMap.values());
        localStorage.setItem("statement_coverage", JSON.stringify(merged));
    } catch (e) {
        console.error("Failed to seed statement coverage records:", e);
    }
};

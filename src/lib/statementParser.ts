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

// Add a statement record to localStorage
export const addStatementRecord = (
    card: string,
    startDate: string,
    endDate: string,
    filename: string
): void => {
    try {
        const records = getStatementRecords();
        // Check for duplicate cycle or filename
        const existingIdx = records.findIndex(
            (r) => r.card === card && (r.filename === filename || (r.startDate === startDate && r.endDate === endDate))
        );

        const newRecord: StatementRecord = {
            card,
            startDate,
            endDate,
            filename: filename || "Uploaded Statement",
            importedAt: Date.now()
        };

        if (existingIdx >= 0) {
            records[existingIdx] = newRecord; // Update imported time / file info
        } else {
            records.push(newRecord);
        }

        localStorage.setItem("statement_coverage", JSON.stringify(records));
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

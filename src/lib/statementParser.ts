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
        // Check for duplicate cycle
        const existingIdx = records.findIndex(
            (r) => r.card === card && r.startDate === startDate && r.endDate === endDate
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

// Seed historical statements if not seeded yet
export const seedStatementRecords = async (): Promise<void> => {
    try {
        const existing = localStorage.getItem("statement_coverage");
        if (existing) return; // already seeded

        const res = await fetch("/seeded_coverage.json");
        if (!res.ok) throw new Error("Failed to load seeded coverage data");
        const seeded: StatementRecord[] = await res.json();
        
        if (seeded && seeded.length > 0) {
            localStorage.setItem("statement_coverage", JSON.stringify(seeded));
        }
    } catch (e) {
        console.error("Failed to seed statement coverage records:", e);
    }
};

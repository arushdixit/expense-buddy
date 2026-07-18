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

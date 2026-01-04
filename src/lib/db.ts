import Dexie, { Table } from 'dexie';

// Sync status for offline changes
export type SyncStatus = 'synced' | 'pending' | 'deleted';

// Local expense type with sync metadata
export interface LocalExpense {
    id: string;
    amount: number;
    category: string;
    subcategory?: string;
    date: string;
    note?: string;
    created_at?: string;
    // Sync metadata
    syncStatus: SyncStatus;
    updatedAt: number; // Unix timestamp for conflict resolution
}

// Local subcategory type with sync metadata
export interface LocalSubcategory {
    id: number;
    category: string;
    name: string;
    syncStatus: SyncStatus;
}

// Sync metadata store
export interface SyncMeta {
    key: string;
    value: string | number;
}

// Dexie database class
export class ExpenseDatabase extends Dexie {
    expenses!: Table<LocalExpense, string>;
    subcategories!: Table<LocalSubcategory, number>;
    syncMeta!: Table<SyncMeta, string>;

    constructor() {
        super('ExpenseBuddyDB');

        this.version(1).stores({
            expenses: 'id, category, date, syncStatus, updatedAt',
            subcategories: 'id, category, syncStatus',
            syncMeta: 'key',
        });
    }
}

// Singleton instance
export const db = new ExpenseDatabase();

// Helper to get current timestamp
export const now = () => Date.now();

// Helper to generate UUID (client-side)
export const generateId = (): string => {
    return crypto.randomUUID();
};

// Get last sync time
export const getLastSyncTime = async (): Promise<number | null> => {
    const meta = await db.syncMeta.get('lastSyncTime');
    return meta ? Number(meta.value) : null;
};

// Set last sync time
export const setLastSyncTime = async (timestamp: number): Promise<void> => {
    await db.syncMeta.put({ key: 'lastSyncTime', value: timestamp });
};

// Get pending changes count
export const getPendingCount = async (): Promise<number> => {
    const pending = await db.expenses
        .where('syncStatus')
        .anyOf(['pending', 'deleted'])
        .count();
    return pending;
};

// Check if there are any pending changes
export const hasPendingChanges = async (): Promise<boolean> => {
    const count = await getPendingCount();
    return count > 0;
};

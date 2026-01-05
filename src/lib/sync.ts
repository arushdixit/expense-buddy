import { db, LocalExpense, LocalSubcategory, now, setLastSyncTime, getLastSyncTime, getPendingCount } from './db';
import { ApiExpense, ApiSubcategory } from './api';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Connection status
let isOnline = navigator.onLine;

// Update online status
if (typeof window !== 'undefined') {
    window.addEventListener('online', () => { isOnline = true; });
    window.addEventListener('offline', () => { isOnline = false; });
}

export const getIsOnline = () => isOnline;

// Check if server is reachable (more accurate than navigator.onLine)
export const checkServerConnection = async (): Promise<boolean> => {
    try {
        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: AbortSignal.timeout(3000), // 3 second timeout
        });
        return response.ok;
    } catch {
        return false;
    }
};

// ----- SYNC ENGINE -----

interface SyncResult {
    success: boolean;
    pushed: number;
    pulled: number;
    errors: string[];
}

/**
 * Manual sync - pushes local changes to server and pulls updates
 */
export async function syncWithServer(): Promise<SyncResult> {
    const result: SyncResult = { success: false, pushed: 0, pulled: 0, errors: [] };

    // Check server availability
    const serverAvailable = await checkServerConnection();
    if (!serverAvailable) {
        result.errors.push('Server is not reachable');
        return result;
    }

    try {
        // 1. Push pending creates/updates
        const pending = await db.expenses.where('syncStatus').equals('pending').toArray();
        for (const expense of pending) {
            try {
                const { syncStatus, updatedAt, ...expenseData } = expense;

                // Check if exists on server
                const checkResponse = await fetch(`${API_BASE_URL}/expenses/${expense.id}`);

                if (checkResponse.status === 404) {
                    // Create new
                    await fetch(`${API_BASE_URL}/expenses`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(expenseData),
                    });
                } else if (checkResponse.ok) {
                    // Update existing
                    await fetch(`${API_BASE_URL}/expenses/${expense.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(expenseData),
                    });
                }

                // Mark as synced
                await db.expenses.update(expense.id, { syncStatus: 'synced' });
                result.pushed++;
            } catch (err) {
                result.errors.push(`Failed to push expense ${expense.id}: ${err}`);
            }
        }

        // 2. Push pending deletes
        const deleted = await db.expenses.where('syncStatus').equals('deleted').toArray();
        for (const expense of deleted) {
            try {
                await fetch(`${API_BASE_URL}/expenses/${expense.id}`, { method: 'DELETE' });
                await db.expenses.delete(expense.id);
                result.pushed++;
            } catch (err) {
                result.errors.push(`Failed to delete expense ${expense.id}: ${err}`);
            }
        }

        // Helper to safely fetch and verify array response
        async function fetchArray<T>(url: string): Promise<T[]> {
            const response = await fetch(url);
            if (!response.ok) {
                const text = await response.text();
                throw new Error(`Server returned ${response.status}: ${text}`);
            }
            const data = await response.json();
            if (!Array.isArray(data)) {
                console.error("Expected array from server, got:", data);
                return [];
            }
            return data;
        }

        // 3. Pull updates from server (Incremental Sync)
        const lastSync = await getLastSyncTime();
        const pullUrl = lastSync
            ? `${API_BASE_URL}/expenses?since=${lastSync}`
            : `${API_BASE_URL}/expenses`;

        const serverExpenses = await fetchArray<ApiExpense>(pullUrl);

        for (const serverExp of serverExpenses) {
            const local = await db.expenses.get(serverExp.id);
            if (!local || local.syncStatus === 'synced') {
                await db.expenses.put({
                    ...serverExp,
                    syncStatus: 'synced',
                    updatedAt: now(),
                });
                result.pulled++;
            }
        }

        // 4. Handle Deletions (Full cleanup occasionally)
        if (!lastSync || Math.random() < 0.1) {
            const allServerExpenses = await fetchArray<ApiExpense>(`${API_BASE_URL}/expenses`);
            const serverIds = new Set(allServerExpenses.map(e => e.id));
            const localSyncedIds = await db.expenses.where('syncStatus').equals('synced').primaryKeys();
            for (const localId of localSyncedIds) {
                if (!serverIds.has(localId)) {
                    await db.expenses.delete(localId);
                }
            }
        }

        // 5. Sync subcategories
        const serverSubcategories = await fetchArray<ApiSubcategory>(`${API_BASE_URL}/subcategories`);
        if (serverSubcategories.length > 0) {
            await db.subcategories.clear();
            await db.subcategories.bulkPut(
                serverSubcategories.map(sub => ({ ...sub, syncStatus: 'synced' as const }))
            );
        }

        await setLastSyncTime(now());
        result.success = true;
    } catch (err) {
        result.errors.push(`Sync failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    return result;
}

// ----- SYNC-AWARE API -----

export const syncApi = {
    // Get all expenses (from IndexedDB)
    async getAllExpenses(): Promise<LocalExpense[]> {
        return db.expenses
            .where('syncStatus')
            .notEqual('deleted')
            .reverse()
            .sortBy('date');
    },

    // Get expenses by date range
    async getExpensesByDateRange(startDate: string, endDate: string): Promise<LocalExpense[]> {
        const all = await this.getAllExpenses();
        return all.filter(e => e.date >= startDate && e.date <= endDate);
    },

    // Get expenses by category
    async getExpensesByCategory(category: string): Promise<LocalExpense[]> {
        const all = await this.getAllExpenses();
        return all.filter(e => e.category.toLowerCase() === category.toLowerCase());
    },

    // Get single expense
    async getExpenseById(id: string): Promise<LocalExpense | undefined> {
        const expense = await db.expenses.get(id);
        if (expense && expense.syncStatus !== 'deleted') {
            return expense;
        }
        return undefined;
    },

    // Create expense (writes to IndexedDB, syncs later)
    async createExpense(expense: Omit<ApiExpense, 'id' | 'created_at'>): Promise<LocalExpense> {
        const id = crypto.randomUUID();
        const timestamp = now();

        const newExpense: LocalExpense = {
            id,
            ...expense,
            created_at: new Date().toISOString(),
            syncStatus: 'pending',
            updatedAt: timestamp,
        };

        await db.expenses.add(newExpense);
        return newExpense;
    },

    // Update expense
    async updateExpense(id: string, updates: Partial<ApiExpense>): Promise<LocalExpense | null> {
        const existing = await db.expenses.get(id);
        if (!existing || existing.syncStatus === 'deleted') {
            return null;
        }

        const updated: LocalExpense = {
            ...existing,
            ...updates,
            syncStatus: 'pending',
            updatedAt: now(),
        };

        await db.expenses.put(updated);
        return updated;
    },

    // Delete expense
    async deleteExpense(id: string): Promise<boolean> {
        const existing = await db.expenses.get(id);
        if (!existing) return false;

        // If it was never synced (created offline), just delete it
        if (existing.syncStatus === 'pending' && !existing.created_at) {
            await db.expenses.delete(id);
        } else {
            // Mark for deletion so it syncs
            await db.expenses.update(id, {
                syncStatus: 'deleted',
                updatedAt: now(),
            });
        }
        return true;
    },

    // Get all subcategories
    async getAllSubcategories(): Promise<LocalSubcategory[]> {
        return db.subcategories.toArray();
    },

    // Get subcategories by category
    async getSubcategoriesByCategory(category: string): Promise<LocalSubcategory[]> {
        return db.subcategories.where('category').equals(category).toArray();
    },

    // Get sync status info
    async getSyncStatus(): Promise<{
        isOnline: boolean;
        pendingCount: number;
        lastSyncTime: number | null;
    }> {
        return {
            isOnline: getIsOnline(),
            pendingCount: await getPendingCount(),
            lastSyncTime: await getLastSyncTime(),
        };
    },
};

// Initial data load check - if IndexedDB is empty, try to sync from server
export async function initializeLocalData(): Promise<void> {
    const count = await db.expenses.count();
    if (count === 0) {
        // First time - try to pull from server
        const serverAvailable = await checkServerConnection();
        if (serverAvailable) {
            await syncWithServer();
        }
    }
}

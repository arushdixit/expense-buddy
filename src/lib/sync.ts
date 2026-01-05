import { db, LocalExpense, LocalSubcategory, now, setLastSyncTime, getLastSyncTime, getPendingCount } from './db';
import { ApiExpense, ApiSubcategory } from './api';

// Dynamic API URL: uses env var if set, otherwise uses current hostname
const API_BASE_URL = import.meta.env.VITE_API_URL
    || (typeof window !== 'undefined' ? `http://${window.location.hostname}:3001/api` : 'http://localhost:3001/api');

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
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        const response = await fetch(`${API_BASE_URL}/health`, {
            method: 'GET',
            signal: controller.signal,
        });

        clearTimeout(timeoutId);
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

        // 3. Pull all from server (full sync for simplicity)
        const serverExpenses = await fetch(`${API_BASE_URL}/expenses`).then(r => r.json()) as ApiExpense[];

        // Get local expense IDs that are synced (not pending)
        const localSyncedIds = new Set(
            (await db.expenses.where('syncStatus').equals('synced').primaryKeys())
        );

        // Update/insert server expenses
        for (const serverExp of serverExpenses) {
            const local = await db.expenses.get(serverExp.id);

            if (!local || local.syncStatus === 'synced') {
                // No local changes, update from server
                await db.expenses.put({
                    ...serverExp,
                    syncStatus: 'synced',
                    updatedAt: now(),
                });
                result.pulled++;
            }
            // If local has pending changes, keep local version (last-write-wins on next push)
        }

        // Remove locally synced items that no longer exist on server
        const serverIds = new Set(serverExpenses.map(e => e.id));
        for (const localId of localSyncedIds) {
            if (!serverIds.has(localId)) {
                await db.expenses.delete(localId);
            }
        }

        // 4. Sync subcategories (read-only from server)
        const serverSubcategories = await fetch(`${API_BASE_URL}/subcategories`).then(r => r.json()) as ApiSubcategory[];
        await db.subcategories.clear();
        await db.subcategories.bulkPut(
            serverSubcategories.map(sub => ({ ...sub, syncStatus: 'synced' as const }))
        );

        // Update last sync time
        await setLastSyncTime(now());

        result.success = true;
    } catch (err) {
        result.errors.push(`Sync failed: ${err}`);
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
        // Use crypto.randomUUID if available, fallback for insecure contexts (HTTP over IP)
        const id = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
                const r = Math.random() * 16 | 0;
                return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
            });
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

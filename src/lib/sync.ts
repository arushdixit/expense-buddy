import { db, LocalExpense, LocalSubcategory, LocalCategory, now, setLastSyncTime, getLastSyncTime, getPendingCount, generateId } from './db';
import { ApiExpense, ApiSubcategory, ApiCategory, expenseApi, subcategoryApi, categoryApi, healthCheck } from './api';

// Connection status - centralized in SyncContext, this is just a fallback
export const getIsOnline = () => navigator.onLine;

// Check if server is reachable (now using unified API)
export const checkServerConnection = async (): Promise<boolean> => {
    try {
        return await healthCheck();
    } catch {
        return false;
    }
};

// ----- SYNC ENGINE -----

// Helper to check if two expense records are equal (excluding sync metadata)
const areExpensesEqual = (local: LocalExpense, server: ApiExpense): boolean => {
    return (
        local.amount === server.amount &&
        local.category === server.category &&
        local.subcategory === server.subcategory &&
        local.date === server.date &&
        local.note === server.note
    );
};

interface SyncResult {
    success: boolean;
    pushed: number;
    pulled: number;
    errors: string[];
}

/**
 * Manual sync - pushes local changes to server and pulls updates
 */
export async function syncWithServer(householdId?: string | null): Promise<SyncResult> {
    const result: SyncResult = { success: false, pushed: 0, pulled: 0, errors: [] };

    // Check availability
    const available = await checkServerConnection();
    if (!available) {
        result.errors.push('Backend is not reachable');
        return result;
    }

    try {
        // 1. Push pending creates/updates
        const pending = await db.expenses.where('syncStatus').equals('pending').toArray();
        for (const expense of pending) {
            try {
                const { syncStatus, updatedAt, ...expenseData } = expense;

                // Check if exists
                const existing = await expenseApi.getById(expense.id);
                if (existing) {
                    await expenseApi.update(expense.id, expenseData);
                } else {
                    // Use original ID and householdId for creation
                    await expenseApi.create({
                        ...expenseData,
                        id: expense.id,
                        household_id: householdId || undefined
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
                await expenseApi.delete(expense.id);
                await db.expenses.delete(expense.id);
                result.pushed++;
            } catch (err) {
                result.errors.push(`Failed to delete expense ${expense.id}: ${err}`);
            }
        }

        // 3. Pull all
        const serverExpenses = await expenseApi.getAll();

        // Get local expense IDs that are synced (not pending)
        const localSyncedIds = new Set(
            (await db.expenses.where('syncStatus').equals('synced').primaryKeys())
        );

        // Update/insert server expenses
        for (const serverExp of serverExpenses) {
            const local = await db.expenses.get(serverExp.id);

            if (!local) {
                await db.expenses.put({
                    ...serverExp,
                    syncStatus: 'synced',
                    updatedAt: now(),
                });
                result.pulled++;
            } else if (local.syncStatus === 'synced') {
                if (!areExpensesEqual(local, serverExp)) {
                    await db.expenses.put({
                        ...serverExp,
                        syncStatus: 'synced',
                        updatedAt: now(),
                    });
                    result.pulled++;
                }
            }
        }

        // Remove local synced items that no longer exist on server
        const serverIds = new Set(serverExpenses.map(e => e.id));
        for (const localId of localSyncedIds) {
            if (!serverIds.has(localId)) {
                await db.expenses.delete(localId as string);
            }
        }

        // 4. Sync subcategories
        const serverSubcategories = await subcategoryApi.getAll();
        await db.subcategories.clear();
        await db.subcategories.bulkPut(
            serverSubcategories.map(sub => ({ ...sub, syncStatus: 'synced' as const }))
        );

        // 5. Sync categories
        const serverCategories = await categoryApi.getAll();
        await db.customCategories.clear();
        await db.customCategories.bulkPut(
            serverCategories.map(cat => ({
                id: cat.id,
                name: cat.name,
                color: cat.color
            }))
        );

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
        const id = generateId();
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

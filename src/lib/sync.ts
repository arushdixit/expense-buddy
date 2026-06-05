import { db, LocalExpense, LocalSubcategory, LocalCategory, now, setLastSyncTime, getLastSyncTime, getPendingCount, generateId } from './db';
import { ApiExpense, ApiSubcategory, ApiCategory, expenseApi, expenseBackupApi, subcategoryApi, categoryApi, healthCheck } from './api';

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
        // 1. Push pending creates/updates (Primary)
        const pending = await db.expenses.where('syncStatus').equals('pending').toArray();
        if (pending.length > 0) {
            try {
                const payload = pending.map(expense => {
                    const { syncStatus, updatedAt, ...expenseData } = expense;
                    return {
                        ...expenseData,
                        household_id: householdId || undefined
                    };
                });
                await expenseApi.upsertBulk(payload);
                await db.expenses.where('id').anyOf(pending.map(e => e.id)).modify({ syncStatus: 'synced' });
                result.pushed += pending.length;
            } catch (err) {
                result.errors.push(`Failed to bulk push expenses: ${err}`);
            }
        }

        // 1b. Push pending creates/updates (Backup)
        const pendingBackup = await db.expenses_backup.where('syncStatus').equals('pending').toArray();
        if (pendingBackup.length > 0) {
            try {
                const payload = pendingBackup.map(expense => {
                    const { syncStatus, updatedAt, ...expenseData } = expense;
                    return {
                        ...expenseData,
                        household_id: householdId || undefined
                    };
                });
                await expenseBackupApi.upsertBulk(payload);
                await db.expenses_backup.where('id').anyOf(pendingBackup.map(e => e.id)).modify({ syncStatus: 'synced' });
                result.pushed += pendingBackup.length;
            } catch (err) {
                result.errors.push(`Failed to bulk push backup expenses: ${err}`);
            }
        }

        // 2. Push pending deletes (Primary)
        const deleted = await db.expenses.where('syncStatus').equals('deleted').toArray();
        if (deleted.length > 0) {
            try {
                const ids = deleted.map(e => e.id);
                await expenseApi.deleteBulk(ids);
                await db.expenses.where('id').anyOf(ids).delete();
                result.pushed += deleted.length;
            } catch (err) {
                result.errors.push(`Failed to bulk delete expenses: ${err}`);
            }
        }

        // 2b. Push pending deletes (Backup)
        const deletedBackup = await db.expenses_backup.where('syncStatus').equals('deleted').toArray();
        if (deletedBackup.length > 0) {
            try {
                const ids = deletedBackup.map(e => e.id);
                await expenseBackupApi.deleteBulk(ids);
                await db.expenses_backup.where('id').anyOf(ids).delete();
                result.pushed += deletedBackup.length;
            } catch (err) {
                result.errors.push(`Failed to bulk delete backup expenses: ${err}`);
            }
        }

        // 3. Pull all (Primary)
        const serverExpenses = await expenseApi.getAll();
        const localSyncedIds = new Set(
            (await db.expenses.where('syncStatus').equals('synced').primaryKeys())
        );

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

        const serverIds = new Set(serverExpenses.map(e => e.id));
        for (const localId of localSyncedIds) {
            if (!serverIds.has(localId)) {
                await db.expenses.delete(localId as string);
            }
        }

        // 3b. Pull all (Backup)
        const serverBackupExpenses = await expenseBackupApi.getAll();
        const localSyncedBackupIds = new Set(
            (await db.expenses_backup.where('syncStatus').equals('synced').primaryKeys())
        );

        for (const serverExp of serverBackupExpenses) {
            const local = await db.expenses_backup.get(serverExp.id);
            if (!local) {
                await db.expenses_backup.put({
                    ...serverExp,
                    syncStatus: 'synced',
                    updatedAt: now(),
                });
                result.pulled++;
            } else if (local.syncStatus === 'synced') {
                if (!areExpensesEqual(local, serverExp)) {
                    await db.expenses_backup.put({
                        ...serverExp,
                        syncStatus: 'synced',
                        updatedAt: now(),
                    });
                    result.pulled++;
                }
            }
        }

        const serverBackupIds = new Set(serverBackupExpenses.map(e => e.id));
        for (const localId of localSyncedBackupIds) {
            if (!serverBackupIds.has(localId)) {
                await db.expenses_backup.delete(localId as string);
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
        try {
            return await db.expenses
                .where('syncStatus')
                .notEqual('deleted')
                .reverse()
                .sortBy('date');
        } catch (err) {
            console.error('Dexie Error in getAllExpenses:', err);
            return [];
        }
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
        try {
            const expense = await db.expenses.get(id);
            if (expense && expense.syncStatus !== 'deleted') {
                return expense;
            }
        } catch (err) {
            console.error('Dexie Error in getExpenseById:', err);
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

    // Get all backup expenses (from IndexedDB)
    async getAllBackupExpenses(): Promise<LocalExpense[]> {
        try {
            return await db.expenses_backup
                .where('syncStatus')
                .notEqual('deleted')
                .reverse()
                .sortBy('date');
        } catch (err) {
            console.error('Dexie Error in getAllBackupExpenses:', err);
            return [];
        }
    },

    // Create backup expense (writes to IndexedDB, syncs later)
    async createBackupExpense(expense: Omit<ApiExpense, 'id' | 'created_at'>): Promise<LocalExpense> {
        const id = generateId();
        const timestamp = now();

        const newExpense: LocalExpense = {
            id,
            ...expense,
            created_at: new Date().toISOString(),
            syncStatus: 'pending',
            updatedAt: timestamp,
        };

        await db.expenses_backup.add(newExpense);
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

    // Delete backup expense
    async deleteBackupExpense(id: string): Promise<boolean> {
        const existing = await db.expenses_backup.get(id);
        if (!existing) return false;

        if (existing.syncStatus === 'pending' && !existing.created_at) {
            await db.expenses_backup.delete(id);
        } else {
            await db.expenses_backup.update(id, {
                syncStatus: 'deleted',
                updatedAt: now(),
            });
        }
        return true;
    },

    // Get all subcategories
    async getAllSubcategories(): Promise<LocalSubcategory[]> {
        try {
            return await db.subcategories.toArray();
        } catch (err) {
            console.error('Dexie Error in getAllSubcategories:', err);
            return [];
        }
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
        isStorageBlocked?: boolean;
    }> {
        try {
            return {
                isOnline: getIsOnline(),
                pendingCount: await getPendingCount(),
                lastSyncTime: await getLastSyncTime(),
            };
        } catch (err) {
            console.error('Dexie Error in getSyncStatus:', err);
            return {
                isOnline: getIsOnline(),
                pendingCount: 0,
                lastSyncTime: null,
                isStorageBlocked: err instanceof Error && (err.name === 'SecurityError' || err.name === 'UnknownError'),
            };
        }
    },
};

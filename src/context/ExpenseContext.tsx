import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Expense, categories, Category, getCategoryById, getCategoryIconAndColor } from "@/lib/data";
import { subcategoryApi, categoryApi, expenseApi, expenseBackupApi, ApiExpense } from "@/lib/api";
import { toast } from "sonner";

interface ExpenseContextType {
  expenses: Expense[];
  backupExpenses: Expense[];
  isLoading: boolean;
  addExpense: (expense: Omit<Expense, "id">) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;
  updateExpense: (id: string, expense: Partial<Expense>) => Promise<void>;
  deleteBackupExpense: (id: string) => Promise<void>;
  bulkAddBackupExpenses: (expenses: Omit<Expense, "id">[]) => Promise<void>;
  mergeBackupToProduction: () => Promise<void>;
  clearBackupQueue: () => Promise<void>;
  customSubcategories: Record<string, string[]>;
  addCustomSubcategory: (categoryId: string, subcategory: string) => Promise<void>;
  customCategories: Category[];
  addCustomCategory: (name: string, color: string) => Promise<void>;
  refreshExpenses: () => Promise<void>;
}

// Convert Supabase backend type to frontend format
const apiExpenseToExpense = (apiExpense: ApiExpense, customCategories: Category[] = []): Expense => {
  const allCategories = [...categories, ...customCategories];
  const category = allCategories.find(cat =>
    cat.name.toLowerCase() === apiExpense.category.toLowerCase()
  );

  return {
    id: apiExpense.id,
    categoryId: category?.id || apiExpense.category.toLowerCase(),
    subcategory: apiExpense.subcategory,
    amount: apiExpense.amount,
    date: apiExpense.date,
    note: apiExpense.note,
    card: apiExpense.card,
    createdAt: apiExpense.created_at,
  };
};

// Convert frontend expense to Supabase API format
const expenseToApiData = (expense: Omit<Expense, "id">, customCategories: Category[] = []) => {
  const category = getCategoryById(expense.categoryId, customCategories);

  return {
    amount: expense.amount,
    category: category?.name || expense.categoryId,
    subcategory: expense.subcategory,
    date: expense.date,
    note: expense.note,
    card: expense.card,
  };
};

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [backupExpenses, setBackupExpenses] = useState<Expense[]>([]);
  const [customSubcategories, setCustomSubcategories] = useState<Record<string, string[]>>({});
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load live data directly from Supabase
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      const [serverCategories, serverSubcategories, serverExpenses, serverBackup] = await Promise.all([
        categoryApi.getAll().catch(err => {
          console.error("Failed to fetch categories:", err);
          return [];
        }),
        subcategoryApi.getAll().catch(err => {
          console.error("Failed to fetch subcategories:", err);
          return [];
        }),
        expenseApi.getAll().catch(err => {
          console.error("Failed to fetch expenses:", err);
          return [];
        }),
        expenseBackupApi.getAll().catch(err => {
          console.error("Failed to fetch backup expenses:", err);
          return [];
        }),
      ]);

      // 1. Process custom categories
      const loadedCategories: Category[] = serverCategories.map(cat => {
        const { icon, color } = getCategoryIconAndColor(cat.name, cat.color);
        return {
          id: cat.id,
          name: cat.name,
          icon,
          color,
        };
      });
      setCustomCategories(loadedCategories);

      // 2. Process subcategories
      const subcategoriesMap: Record<string, string[]> = {};
      const allCategories = [...categories, ...loadedCategories];

      serverSubcategories.forEach(sub => {
        const category = allCategories.find(cat =>
          cat.name.toLowerCase() === sub.category.toLowerCase()
        );
        const categoryId = category?.id || sub.category.toLowerCase();

        if (!subcategoriesMap[categoryId]) {
          subcategoriesMap[categoryId] = [];
        }

        const predefinedSubs = category?.subcategories || [];
        if (!predefinedSubs.includes(sub.name)) {
          subcategoriesMap[categoryId].push(sub.name);
        }
      });
      setCustomSubcategories(subcategoriesMap);

      // 3. Process expenses
      setExpenses(serverExpenses.map(e => apiExpenseToExpense(e, loadedCategories)));
      setBackupExpenses(serverBackup.map(e => apiExpenseToExpense(e, loadedCategories)));
    } catch (error) {
      console.error('Failed to load data from Supabase:', error);
      toast.error('Failed to load expenses from server');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh all data on demand
  const refreshExpenses = useCallback(async () => {
    await loadData();
  }, [loadData]);

  // Initial fetch on mount
  useEffect(() => {
    loadData();
  }, [loadData]);

  const addExpense = async (expense: Omit<Expense, "id">) => {
    try {
      const apiData = expenseToApiData(expense, customCategories);
      const created = await expenseApi.create(apiData);
      const mapped = apiExpenseToExpense(created, customCategories);
      setExpenses(prev => [mapped, ...prev]);
      toast.success('Expense added');
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add expense');
      throw error;
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await expenseApi.delete(id);
      setExpenses(prev => prev.filter(exp => exp.id !== id));
      toast.success('Expense deleted');
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete expense');
      throw error;
    }
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    try {
      const apiUpdates: Partial<ApiExpense> = {};
      if (updates.amount !== undefined) apiUpdates.amount = updates.amount;
      if (updates.date !== undefined) apiUpdates.date = updates.date;
      if (updates.note !== undefined) apiUpdates.note = updates.note;
      if (updates.card !== undefined) apiUpdates.card = updates.card;
      if (updates.subcategory !== undefined) apiUpdates.subcategory = updates.subcategory;
      if (updates.categoryId !== undefined) {
        const category = getCategoryById(updates.categoryId, customCategories);
        apiUpdates.category = category?.name || updates.categoryId;
      }

      const updated = await expenseApi.update(id, apiUpdates);
      const mapped = apiExpenseToExpense(updated, customCategories);
      setExpenses(prev => prev.map(exp => (exp.id === id ? mapped : exp)));
      toast.success('Expense updated');
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to update expense');
      throw error;
    }
  };

  const deleteBackupExpense = async (id: string) => {
    try {
      await expenseBackupApi.delete(id);
      setBackupExpenses(prev => prev.filter(exp => exp.id !== id));
      toast.success('Backup transaction removed');
    } catch (error) {
      console.error('Failed to delete backup expense:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to delete backup transaction');
      throw error;
    }
  };

  const bulkAddBackupExpenses = async (newExpenses: Omit<Expense, "id">[]) => {
    try {
      const toUpsert = newExpenses.map(e => expenseToApiData(e, customCategories));
      const created = await expenseBackupApi.upsertBulk(toUpsert);
      const mapped = created.map(e => apiExpenseToExpense(e, customCategories));
      setBackupExpenses(prev => [...mapped, ...prev]);
      toast.success(`Uploaded ${newExpenses.length} transactions to backup queue`);
    } catch (error) {
      console.error('Failed bulk backup upload:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to upload transactions to backup queue');
      throw error;
    }
  };

  const mergeBackupToProduction = async () => {
    try {
      if (backupExpenses.length === 0) {
        toast.info('No transactions in backup queue');
        return;
      }

      const merged = await expenseBackupApi.mergeToProduction();
      const mapped = merged.map(e => apiExpenseToExpense(e, customCategories));
      setExpenses(prev => [...mapped, ...prev]);
      setBackupExpenses([]);
      toast.success(`Successfully merged ${merged.length} transactions to production!`);
    } catch (error) {
      console.error('Failed to merge backup to production:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to merge transactions');
    }
  };

  const clearBackupQueue = async () => {
    try {
      await expenseBackupApi.clearQueue();
      setBackupExpenses([]);
      toast.success('Backup queue cleared');
    } catch (error) {
      console.error('Failed to clear backup queue:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to clear backup queue');
    }
  };

  const addCustomSubcategory = async (categoryId: string, subcategory: string) => {
    const category = getCategoryById(categoryId, customCategories);
    const categoryName = category?.name || categoryId;

    try {
      await subcategoryApi.create(categoryName, subcategory);
      setCustomSubcategories(prev => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), subcategory],
      }));
      toast.success('Subcategory added');
    } catch (error) {
      console.error('Failed to add subcategory:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add subcategory');
    }
  };

  const addCustomCategory = async (name: string, color: string) => {
    try {
      const serverCategory = await categoryApi.create(name, color);
      const { icon, color: finalColor } = getCategoryIconAndColor(serverCategory.name, serverCategory.color);
      const newCategory: Category = {
        id: serverCategory.id,
        name: serverCategory.name,
        icon,
        color: finalColor,
      };

      setCustomCategories(prev => [...prev, newCategory]);
      toast.success('Category added');
    } catch (error) {
      console.error('Failed to add category:', error);
      toast.error(error instanceof Error ? error.message : 'Failed to add category');
    }
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        backupExpenses,
        isLoading,
        addExpense,
        deleteExpense,
        updateExpense,
        deleteBackupExpense,
        bulkAddBackupExpenses,
        mergeBackupToProduction,
        clearBackupQueue,
        customSubcategories,
        addCustomSubcategory,
        customCategories,
        addCustomCategory,
        refreshExpenses,
      }}
    >
      {children}
    </ExpenseContext.Provider>
  );
};

export const useExpenses = (): ExpenseContextType => {
  const context = useContext(ExpenseContext);
  if (!context) {
    throw new Error("useExpenses must be used within an ExpenseProvider");
  }
  return context;
};

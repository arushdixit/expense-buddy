import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Expense, categories, Category, getCategoryById } from "@/lib/data";
import { syncApi } from "@/lib/sync";
import { subcategoryApi, categoryApi } from "@/lib/api";
import { db, LocalExpense, LocalSubcategory, generateId } from "@/lib/db";
import { Layers } from "lucide-react";
import { toast } from "sonner";
import { useSync } from "@/context/SyncContext";

interface ExpenseContextType {
  expenses: Expense[];
  isLoading: boolean;
  addExpense: (expense: Omit<Expense, "id">) => void;
  deleteExpense: (id: string) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  customSubcategories: Record<string, string[]>;
  addCustomSubcategory: (categoryId: string, subcategory: string) => void;
  customCategories: Category[];
  addCustomCategory: (name: string, color: string) => void;
  refreshExpenses: () => Promise<void>;
}

// Helper function to convert local expense to frontend format
const localExpenseToExpense = (localExpense: LocalExpense, customCategories: Category[] = []): Expense => {
  const allCategories = [...categories, ...customCategories];
  const category = allCategories.find(cat =>
    cat.name.toLowerCase() === localExpense.category.toLowerCase()
  );

  return {
    id: localExpense.id,
    categoryId: category?.id || localExpense.category.toLowerCase(),
    subcategory: localExpense.subcategory,
    amount: localExpense.amount,
    date: localExpense.date,
    note: localExpense.note,
  };
};

// Helper function to convert frontend expense to sync API format
const expenseToLocalData = (expense: Omit<Expense, "id">, customCategories: Category[] = []) => {
  // Look in both predefined and custom categories
  const category = getCategoryById(expense.categoryId, customCategories);

  return {
    amount: expense.amount,
    category: category?.name || expense.categoryId, // Should always find it now
    subcategory: expense.subcategory,
    date: expense.date,
    note: expense.note,
  };
};

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customSubcategories, setCustomSubcategories] = useState<Record<string, string[]>>({});
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Access sync context for refreshing after sync and triggering auto-sync
  const { refreshStatus, registerSyncCallback, unregisterSyncCallback, triggerSync, isOnline } = useSync();

  // Auto-sync debounce timer
  const autoSyncTimerRef = React.useRef<NodeJS.Timeout | null>(null);

  // Trigger auto-sync after a delay (debounced)
  const scheduleAutoSync = useCallback(() => {
    // Clear any existing timer
    if (autoSyncTimerRef.current) {
      clearTimeout(autoSyncTimerRef.current);
    }

    // Only schedule if online
    if (isOnline) {
      // Schedule sync after 2 seconds of inactivity
      autoSyncTimerRef.current = setTimeout(async () => {
        try {
          await triggerSync();
        } catch (error) {
          console.error('Auto-sync failed:', error);
        }
      }, 2000);
    }
  }, [isOnline, triggerSync]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (autoSyncTimerRef.current) {
        clearTimeout(autoSyncTimerRef.current);
      }
    };
  }, []);

  // Load data from IndexedDB
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Load expenses from IndexedDB
      const localExpenses = await syncApi.getAllExpenses();
      const mappedExpenses = localExpenses.map(e => localExpenseToExpense(e, loadedCategories));
      setExpenses(mappedExpenses);

      // Load subcategories and group by category
      const localSubcategories = await syncApi.getAllSubcategories();
      const subcategoriesMap: Record<string, string[]> = {};

      localSubcategories.forEach((sub: LocalSubcategory) => {
        // Find the category ID for this category name
        const category = categories.find(cat =>
          cat.name.toLowerCase() === sub.category.toLowerCase()
        );
        const categoryId = category?.id || sub.category.toLowerCase();

        if (!subcategoriesMap[categoryId]) {
          subcategoriesMap[categoryId] = [];
        }

        // Only add if not already in predefined subcategories
        const predefinedSubs = category?.subcategories || [];
        if (!predefinedSubs.includes(sub.name)) {
          subcategoriesMap[categoryId].push(sub.name);
        }
      });

      setCustomSubcategories(subcategoriesMap);

      // Load custom categories from IndexedDB
      const localCategories = await db.customCategories.toArray();
      const loadedCategories: Category[] = localCategories.map(cat => ({
        id: cat.id,
        name: cat.name,
        icon: Layers,
        color: cat.color,
      }));
      setCustomCategories(loadedCategories);
    } catch (error) {
      console.error('Failed to load data:', error);
      toast.error('Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh expenses (called after sync or data changes)
  const refreshExpenses = useCallback(async () => {
    try {
      const localExpenses = await syncApi.getAllExpenses();
      const mappedExpenses = localExpenses.map(e => localExpenseToExpense(e, customCategories));
      setExpenses(mappedExpenses);
    } catch (error) {
      console.error('Failed to refresh expenses:', error);
    }
  }, [customCategories]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Register for sync completion notifications to refresh expenses
  useEffect(() => {
    registerSyncCallback(refreshExpenses);
    return () => {
      unregisterSyncCallback(refreshExpenses);
    };
  }, [refreshExpenses, registerSyncCallback, unregisterSyncCallback]);

  const addExpense = async (expense: Omit<Expense, "id">) => {
    try {
      const localData = expenseToLocalData(expense, customCategories);
      const createdExpense = await syncApi.createExpense(localData);
      const mappedExpense = localExpenseToExpense(createdExpense, customCategories);
      setExpenses(prev => [mappedExpense, ...prev]);
      refreshStatus(); // Update pending count in bg
      scheduleAutoSync(); // Trigger auto-sync
      toast.success('Expense added');
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast.error('Failed to add expense');
      throw error;
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await syncApi.deleteExpense(id);
      setExpenses(prev => prev.filter(exp => exp.id !== id));
      refreshStatus(); // Update pending count in bg
      scheduleAutoSync(); // Trigger auto-sync
      toast.success('Expense deleted');
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('Failed to delete expense');
      throw error;
    }
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    try {
      // Convert updates to local format
      const localUpdates: Record<string, unknown> = {};
      if (updates.amount !== undefined) localUpdates.amount = updates.amount;
      if (updates.date !== undefined) localUpdates.date = updates.date;
      if (updates.note !== undefined) localUpdates.note = updates.note;
      if (updates.subcategory !== undefined) localUpdates.subcategory = updates.subcategory;
      if (updates.categoryId !== undefined) {
        const category = getCategoryById(updates.categoryId, customCategories);
        localUpdates.category = category?.name || updates.categoryId;
      }

      const updatedExpense = await syncApi.updateExpense(id, localUpdates);
      if (updatedExpense) {
        const mappedExpense = localExpenseToExpense(updatedExpense, customCategories);
        setExpenses(prev =>
          prev.map(exp => (exp.id === id ? mappedExpense : exp))
        );
        refreshStatus(); // Update pending count in bg
        scheduleAutoSync(); // Trigger auto-sync
        toast.success('Expense updated');
      }
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast.error('Failed to update expense');
      throw error;
    }
  };

  const addCustomSubcategory = async (categoryId: string, subcategory: string) => {
    // Get the category name for saving to Supabase
    const category = getCategoryById(categoryId, customCategories);
    const categoryName = category?.name || categoryId;

    try {
      // Try to save to Supabase first
      if (isOnline) {
        await subcategoryApi.create(categoryName, subcategory);
      }

      // Add to local state
      setCustomSubcategories(prev => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), subcategory],
      }));

      toast.success('Subcategory added');
    } catch (error) {
      // If offline or error, still add locally
      setCustomSubcategories(prev => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), subcategory],
      }));

      if (!isOnline) {
        toast.success('Subcategory saved locally (will sync when online)');
      } else {
        console.error('Failed to add subcategory:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to add subcategory');
      }
    }
  };

  const addCustomCategory = async (name: string, color: string) => {
    try {
      // Try to save to Supabase first (this also validates uniqueness)
      const serverCategory = await categoryApi.create(name, color);

      // Save to local IndexedDB for offline access
      await db.customCategories.put({ id: serverCategory.id, name: serverCategory.name, color: serverCategory.color });

      const newCategory: Category = {
        id: serverCategory.id,
        name: serverCategory.name,
        icon: Layers,
        color: serverCategory.color,
      };

      setCustomCategories(prev => [...prev, newCategory]);
      toast.success('Category added');
    } catch (error) {
      // If offline or error, save locally only
      if (!isOnline) {
        const id = generateId();
        await db.customCategories.add({ id, name, color });

        const newCategory: Category = {
          id,
          name,
          icon: Layers,
          color,
        };

        setCustomCategories(prev => [...prev, newCategory]);
        toast.success('Category saved locally (will sync when online)');
      } else {
        console.error('Failed to add category:', error);
        toast.error(error instanceof Error ? error.message : 'Failed to add category');
      }
    }
  };

  return (
    <ExpenseContext.Provider
      value={{
        expenses,
        isLoading,
        addExpense,
        deleteExpense,
        updateExpense,
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

import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from "react";
import { Expense, categories, Category, getCategoryById } from "@/lib/data";
import { syncApi, initializeLocalData } from "@/lib/sync";
import { LocalExpense, LocalSubcategory } from "@/lib/db";
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

  // Helper function to convert local expense to frontend format
  const localExpenseToExpense = (localExpense: LocalExpense): Expense => {
    // Find category by name
    const category = categories.find(cat =>
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
  const expenseToLocalData = (expense: Omit<Expense, "id">) => {
    const category = getCategoryById(expense.categoryId);

    return {
      amount: expense.amount,
      category: category?.name || expense.categoryId,
      subcategory: expense.subcategory,
      date: expense.date,
      note: expense.note,
    };
  };

  // Load data from IndexedDB
  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Initialize local data (will sync from server if first time)
      await initializeLocalData();

      // Load expenses from IndexedDB
      const localExpenses = await syncApi.getAllExpenses();
      const mappedExpenses = localExpenses.map(localExpenseToExpense);
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
      const mappedExpenses = localExpenses.map(localExpenseToExpense);
      setExpenses(mappedExpenses);
    } catch (error) {
      console.error('Failed to refresh expenses:', error);
    }
  }, []);

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
      const localData = expenseToLocalData(expense);
      const createdExpense = await syncApi.createExpense(localData);
      const mappedExpense = localExpenseToExpense(createdExpense);
      setExpenses(prev => [mappedExpense, ...prev]);
      await refreshStatus(); // Update pending count
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
      await refreshStatus(); // Update pending count
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
        const category = getCategoryById(updates.categoryId);
        localUpdates.category = category?.name || updates.categoryId;
      }

      const updatedExpense = await syncApi.updateExpense(id, localUpdates);
      if (updatedExpense) {
        const mappedExpense = localExpenseToExpense(updatedExpense);
        setExpenses(prev =>
          prev.map(exp => (exp.id === id ? mappedExpense : exp))
        );
        await refreshStatus(); // Update pending count
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
    // For now, just add locally. Will sync when adding expense with this subcategory
    setCustomSubcategories(prev => ({
      ...prev,
      [categoryId]: [...(prev[categoryId] || []), subcategory],
    }));
    toast.success('Subcategory added');
  };

  const addCustomCategory = (name: string, color: string) => {
    const newCategory: Category = {
      id: `custom-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name,
      icon: Layers,
      color,
    };
    setCustomCategories(prev => [...prev, newCategory]);
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

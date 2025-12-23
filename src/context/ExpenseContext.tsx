import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Expense, categories, Category, getCategoryById } from "@/lib/data";
import { expenseApi, subcategoryApi, ApiExpense } from "@/lib/api";
import { Layers } from "lucide-react";
import { toast } from "sonner";

interface ExpenseContextType {
  expenses: Expense[];
  addExpense: (expense: Omit<Expense, "id">) => void;
  deleteExpense: (id: string) => void;
  updateExpense: (id: string, expense: Partial<Expense>) => void;
  customSubcategories: Record<string, string[]>;
  addCustomSubcategory: (categoryId: string, subcategory: string) => void;
  customCategories: Category[];
  addCustomCategory: (name: string, color: string) => void;
}

const ExpenseContext = createContext<ExpenseContextType | undefined>(undefined);

export const ExpenseProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [customSubcategories, setCustomSubcategories] = useState<Record<string, string[]>>({});
  const [customCategories, setCustomCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Helper function to convert API expense to frontend format
  const apiExpenseToExpense = (apiExpense: ApiExpense): Expense => {
    // Find category by name
    const category = categories.find(cat => 
      cat.name.toLowerCase() === apiExpense.category.toLowerCase()
    );
    
    return {
      id: apiExpense.id,
      categoryId: category?.id || apiExpense.category.toLowerCase(),
      subcategory: apiExpense.subcategory,
      amount: apiExpense.amount,
      date: apiExpense.date,
      note: apiExpense.note,
    };
  };

  // Helper function to convert frontend expense to API format
  const expenseToApiExpense = (expense: Omit<Expense, "id">): Omit<ApiExpense, "id" | "created_at"> => {
    const category = getCategoryById(expense.categoryId);
    
    return {
      amount: expense.amount,
      category: category?.name || expense.categoryId,
      subcategory: expense.subcategory,
      date: expense.date,
      note: expense.note,
    };
  };

  // Load initial data from API
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        
        // Load expenses
        const apiExpenses = await expenseApi.getAll();
        const mappedExpenses = apiExpenses.map(apiExpenseToExpense);
        setExpenses(mappedExpenses);

        // Load subcategories and group by category
        const apiSubcategories = await subcategoryApi.getAll();
        const subcategoriesMap: Record<string, string[]> = {};
        
        apiSubcategories.forEach(sub => {
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
        toast.error('Failed to load data from server');
      } finally {
        setIsLoading(false);
      }
    };

    loadData();
  }, []);

  const addExpense = async (expense: Omit<Expense, "id">) => {
    try {
      const apiExpenseData = expenseToApiExpense(expense);
      const createdExpense = await expenseApi.create(apiExpenseData);
      const mappedExpense = apiExpenseToExpense(createdExpense);
      setExpenses(prev => [mappedExpense, ...prev]);
      toast.success('Expense added successfully');
    } catch (error) {
      console.error('Failed to add expense:', error);
      toast.error('Failed to add expense');
      throw error;
    }
  };

  const deleteExpense = async (id: string) => {
    try {
      await expenseApi.delete(id);
      setExpenses(prev => prev.filter(exp => exp.id !== id));
      toast.success('Expense deleted successfully');
    } catch (error) {
      console.error('Failed to delete expense:', error);
      toast.error('Failed to delete expense');
      throw error;
    }
  };

  const updateExpense = async (id: string, updates: Partial<Expense>) => {
    try {
      // Convert updates to API format
      const apiUpdates: Partial<ApiExpense> = {};
      if (updates.amount !== undefined) apiUpdates.amount = updates.amount;
      if (updates.date !== undefined) apiUpdates.date = updates.date;
      if (updates.note !== undefined) apiUpdates.note = updates.note;
      if (updates.subcategory !== undefined) apiUpdates.subcategory = updates.subcategory;
      if (updates.categoryId !== undefined) {
        const category = getCategoryById(updates.categoryId);
        apiUpdates.category = category?.name || updates.categoryId;
      }

      const updatedApiExpense = await expenseApi.update(id, apiUpdates);
      const mappedExpense = apiExpenseToExpense(updatedApiExpense);
      
      setExpenses(prev =>
        prev.map(exp => (exp.id === id ? mappedExpense : exp))
      );
      toast.success('Expense updated successfully');
    } catch (error) {
      console.error('Failed to update expense:', error);
      toast.error('Failed to update expense');
      throw error;
    }
  };

  const addCustomSubcategory = async (categoryId: string, subcategory: string) => {
    try {
      const category = getCategoryById(categoryId);
      const categoryName = category?.name || categoryId;
      
      await subcategoryApi.create(categoryName, subcategory);
      
      setCustomSubcategories(prev => ({
        ...prev,
        [categoryId]: [...(prev[categoryId] || []), subcategory],
      }));
      toast.success('Subcategory added successfully');
    } catch (error) {
      console.error('Failed to add subcategory:', error);
      toast.error('Failed to add subcategory');
      throw error;
    }
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
        addExpense,
        deleteExpense,
        updateExpense,
        customSubcategories,
        addCustomSubcategory,
        customCategories,
        addCustomCategory,
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

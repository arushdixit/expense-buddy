import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { Expense, generateMockExpenses, categories, Category } from "@/lib/data";
import { Layers } from "lucide-react";

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
  const [expenses, setExpenses] = useState<Expense[]>(() => {
    const saved = localStorage.getItem("expenses");
    if (saved) {
      return JSON.parse(saved);
    }
    return generateMockExpenses();
  });

  const [customSubcategories, setCustomSubcategories] = useState<Record<string, string[]>>(() => {
    const saved = localStorage.getItem("customSubcategories");
    if (saved) {
      return JSON.parse(saved);
    }
    return {};
  });

  const [customCategories, setCustomCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem("customCategories");
    if (saved) {
      return JSON.parse(saved);
    }
    return [];
  });

  useEffect(() => {
    localStorage.setItem("expenses", JSON.stringify(expenses));
  }, [expenses]);

  useEffect(() => {
    localStorage.setItem("customSubcategories", JSON.stringify(customSubcategories));
  }, [customSubcategories]);

  useEffect(() => {
    localStorage.setItem("customCategories", JSON.stringify(customCategories));
  }, [customCategories]);

  const addExpense = (expense: Omit<Expense, "id">) => {
    const newExpense: Expense = {
      ...expense,
      id: `exp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };
    setExpenses(prev => [newExpense, ...prev]);
  };

  const deleteExpense = (id: string) => {
    setExpenses(prev => prev.filter(exp => exp.id !== id));
  };

  const updateExpense = (id: string, updates: Partial<Expense>) => {
    setExpenses(prev =>
      prev.map(exp => (exp.id === id ? { ...exp, ...updates } : exp))
    );
  };

  const addCustomSubcategory = (categoryId: string, subcategory: string) => {
    setCustomSubcategories(prev => ({
      ...prev,
      [categoryId]: [...(prev[categoryId] || []), subcategory],
    }));
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

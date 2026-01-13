import { Home, ShoppingCart, ShoppingBag, Ticket, Zap, Diamond, Scissors, Car, LucideIcon } from "lucide-react";

export interface Category {
  id: string;
  name: string;
  icon: LucideIcon;
  color: string;
  subcategories?: string[];
}

export interface Expense {
  id: string;
  categoryId: string;
  subcategory?: string;
  amount: number;
  date: string;
  note?: string;
  createdAt?: string;
}

export interface MonthlyData {
  month: string;
  year: number;
  total: number;
  expenses: Expense[];
}

export const categories: Category[] = [
  {
    id: "rent",
    name: "Rent",
    icon: Home,
    color: "hsl(var(--chart-rent))",
  },
  {
    id: "groceries",
    name: "Groceries",
    icon: ShoppingCart,
    color: "hsl(var(--chart-groceries))",
    subcategories: ["Carrefour", "Noon", "Careem", "West Zone", "Talabat", "Amazon Now", "Grandiose", "Spinneys", "Madhoor", "Refund"],
  },
  {
    id: "shopping",
    name: "Shopping",
    icon: ShoppingBag,
    color: "hsl(var(--chart-shopping))",
    subcategories: ["Clothes", "Skincare", "Accessories", "Miscellaneous", "Refund"],
  },
  {
    id: "entertainment",
    name: "Entertainment",
    icon: Ticket,
    color: "hsl(var(--chart-entertainment))",
    subcategories: ["Dine-out", "Food Delivery", "Activities", "Refund"],
  },
  {
    id: "utilities",
    name: "Utilities",
    icon: Zap,
    color: "hsl(var(--chart-utilities))",
    subcategories: ["Cook Salary", "Internet", "DEWA", "Mobile Recharge", "Chiller", "Refund"],
  },
  {
    id: "luxury",
    name: "Luxury",
    icon: Diamond,
    color: "hsl(var(--chart-luxury))",
    subcategories: ["Refund"],
  },
  {
    id: "grooming",
    name: "Grooming",
    icon: Scissors,
    color: "hsl(var(--chart-grooming))",
    subcategories: ["Refund"],
  },
  {
    id: "transport",
    name: "Transport",
    icon: Car,
    color: "hsl(var(--chart-transport))",
    subcategories: ["Refund"],
  },
];

export const formatCurrency = (amount: number): string => {
  const isNegative = amount < 0;
  const absAmount = Math.abs(amount);
  const formattedAmount = Math.round(absAmount).toLocaleString('en-US');
  return `${isNegative ? '-' : ''}ê ${formattedAmount}`;
};

export const getMonthName = (monthIndex: number): string => {
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return months[monthIndex];
};

export const getShortMonthName = (monthIndex: number): string => {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return months[monthIndex];
};

export const getCategoryById = (id: string, customCategories: Category[] = []): Category | undefined => {
  const allCategories = [...categories, ...customCategories];
  return allCategories.find(cat => cat.id === id);
};

export const calculateCategoryTotals = (expenses: Expense[]): Record<string, number> => {
  return expenses.reduce((acc, expense) => {
    acc[expense.categoryId] = (acc[expense.categoryId] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);
};

export const calculateSubcategoryTotals = (expenses: Expense[]): Record<string, number> => {
  return expenses.reduce((acc, expense) => {
    const key = expense.subcategory || "Other";
    acc[key] = (acc[key] || 0) + expense.amount;
    return acc;
  }, {} as Record<string, number>);
};

export const getExpensesByMonth = (expenses: Expense[], year: number, month: number): Expense[] => {
  return expenses.filter(expense => {
    const date = new Date(expense.date);
    return date.getFullYear() === year && date.getMonth() === month;
  });
};
